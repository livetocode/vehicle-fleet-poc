
use datafusion::arrow::array::{
    Array, ArrayRef, Float64Array, Int32Array, StringArray, StringViewArray,
    TimestampMillisecondArray,
};
use datafusion::arrow::datatypes::{DataType, TimeUnit};
use datafusion::prelude::*;
use chrono::{prelude::*, Utc};
use std::time::Instant; 
use futures_util::StreamExt;

pub fn format_value_as_string(array: &ArrayRef, row_index: usize) -> String {
    if array.is_null(row_index) {
        return "NULL".to_string();
    }

    match array.data_type() {
        DataType::Int32 => {
            let int_array = array.as_any().downcast_ref::<Int32Array>().unwrap();
            int_array.value(row_index).to_string()
        }
        DataType::Utf8 => {
            let string_array = array.as_any().downcast_ref::<StringArray>().unwrap();
            format!("{}", string_array.value(row_index))
        }
        DataType::Utf8View => {
            let view_array = array.as_any().downcast_ref::<StringViewArray>().unwrap();
            format!("{}", view_array.value(row_index))
        }
        DataType::Float64 => {
            let float_array = array.as_any().downcast_ref::<Float64Array>().unwrap();
            format!("{:.2}", float_array.value(row_index))
        }
        DataType::Timestamp(TimeUnit::Millisecond, None) => {
            let ts_array = array.as_any().downcast_ref::<TimestampMillisecondArray>().unwrap();
            let millis = ts_array.value(row_index);
            if let Some(datetime) = Utc.timestamp_millis_opt(millis).single() {
                datetime.format("%Y-%m-%d %H:%M:%S").to_string()
            } else {
                "INVALID TIMESTAMP".to_string()
            }
        }
        _ => "UNHANDLED_TYPE".to_string(),
    }
}

pub async fn execute_query(ctx: &SessionContext, query: &str, verbose: bool) ->  datafusion::error::Result<()> {

    let df = ctx
        .sql(&query)
        .await?;
    
    let schema = df.schema();
    let headers: Vec<String> = schema
        .fields()
        .iter()
        .map(|f| f.name().clone())
        .collect();

    let start_time = Instant::now();

    let mut stream = df.execute_stream().await?;
    
    let mut batch_idx = 0;
    let mut global_row_idx = 0;

    let mut max_widths: Vec<usize> = headers.iter().map(|h| h.len()).collect();
    
    while let Some(batch_result) = stream.next().await {
        let batch = batch_result?;
        batch_idx += 1;

        println!("\nBatch #{}", batch_idx);
        
        if verbose {
            let num_rows = batch.num_rows();
            let mut rows: Vec<Vec<String>> = Vec::with_capacity(num_rows);
            
            for i in 0..num_rows {
                let mut cols: Vec<String> = Vec::with_capacity(batch.num_columns());
                
                for j in 0..batch.num_columns() {
                    let column = batch.column(j);
                    let value_string = format_value_as_string(column, i);
                    if value_string.len() > max_widths[j] {
                        max_widths[j] = value_string.len();
                    }
                    cols.push(value_string);
                }
                rows.push(cols);
            }

            let max_row_num_width = (global_row_idx + num_rows).to_string().len();

            print!("{:>width$} ", "#", width = max_row_num_width);
            for (i, header) in headers.iter().enumerate() {
                print!("| {:<width$} ", header, width = max_widths[i]);
            }
            println!("\n{:-<width$}", "", width = max_row_num_width + 2 + max_widths.iter().sum::<usize>() + max_widths.len() * 3 - 1);

            for row in rows.iter() {
                global_row_idx += 1;
                if verbose {
                    print!("{:>width$} ", global_row_idx, width = max_row_num_width);
                    for j in 0..row.len() {                        
                        print!("| {:<width$} ", row[j], width = max_widths[j]);
                    }
                    println!();
                }
            }
        } else {
            global_row_idx += batch.num_rows();
        }
    }
    let duration = start_time.elapsed();
    println!("");
    println!("{}", query);
    println!("");
    println!("Rows: {}", global_row_idx);
    println!("Batches: {}", batch_idx);
    if batch_idx > 0 {
        println!("Batch size: {}", global_row_idx/batch_idx);
    }
    println!("");
    println!("Elapsed time: {} ms", duration.as_millis());

    Ok(())
}        
