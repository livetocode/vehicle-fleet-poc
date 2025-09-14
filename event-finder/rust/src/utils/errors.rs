pub fn to_string_error<T: ToString>(err: T) -> String {
    err.to_string()
}

pub fn to_datafusion_error<T: ToString>(err: T) -> datafusion::error::DataFusionError {
    datafusion::error::DataFusionError::Internal(err.to_string())
}
