use chrono::{prelude::*, Utc, DateTime, Duration};

pub fn round_datetime_modulo_minutes(dt: DateTime<Utc>, modulo: u32) -> (DateTime<Utc>, DateTime<Utc>) {
    assert!(modulo > 0, "modulo must be greater than zero");
    let minutes = dt.minute();
    let lower_minute = minutes - (minutes % modulo);

    let lower = dt
        .with_minute(lower_minute)
        .unwrap()
        .with_second(0)
        .unwrap()
        .with_nanosecond(0)
        .unwrap();

    let mut upper = lower + Duration::minutes(modulo as i64);
    if upper <= dt {
        upper = upper + Duration::minutes(modulo as i64);
    }

    (lower, upper)
}
