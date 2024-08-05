import math
from readable_number import ReadableNumber

def convert_size(size_bytes):
   if size_bytes == 0:
       return "0B"
   size_name = ("B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB")
   i = int(math.floor(math.log(size_bytes, 1024)))
   p = math.pow(1024, i)
   s = round(size_bytes / p, 2)
   return "%s %s" % (s, size_name[i])

# Geohash of precision 5 is 4.9km x 4.9km
# Geohash of precision 6 is 1.2km * 609.4m

geohash_precision = {
    5: {
        "width": 4.9,
        "height": 4.9,
    },
    6: {
        "width": 1.2,
        "height": 0.6,
    },
}

def estimate_geohash_partitions(area_width: int, area_height: int, precision: int):
    geohash = geohash_precision[precision]
    w = area_width / geohash["width"]
    h = area_height / geohash["height"]
    return w * h


def estimate(vehicle_count: int, refresh_interval_in_secs: int, area_widh_km: int, area_height_km: int, period_in_min: int, collector_count: int, event_size: int):
    assert(refresh_interval_in_secs <= 60)
    events_per_vehicle_per_minute = 60 / refresh_interval_in_secs
    events_per_minute = vehicle_count * events_per_vehicle_per_minute
    events_per_period = events_per_minute * period_in_min
    periods_per_hour = 60 / period_in_min
    events_per_hour = events_per_period * periods_per_hour
    events_per_day = events_per_hour * 24
    events_per_year = 365 * events_per_day
    periods_per_hour = 60 / period_in_min
    periods_per_day = 24 * periods_per_hour
    periods_per_year = 365 * periods_per_day
    size_per_period = events_per_period * event_size
    size_per_hour = events_per_hour * event_size
    size_per_day = events_per_day * event_size
    size_per_year = events_per_year * event_size

    print(f"Vehicles      = {ReadableNumber(vehicle_count)}")
    print(f"Period        = {period_in_min} minutes")
    print(f"Interval      = {refresh_interval_in_secs} secs")
    print(f"events/minute = {ReadableNumber(events_per_minute)}")
    print(f"events/period = {ReadableNumber(events_per_period)}")
    print(f"events/hour   = {ReadableNumber(events_per_hour)}")
    print(f"events/day    = {ReadableNumber(events_per_day, use_shortform=True, precision = 1)}")
    print(f"events/year   = {ReadableNumber(events_per_year, use_shortform=True, precision = 1)}")
    print(f"periods/hour  = {ReadableNumber(periods_per_hour)}")
    print(f"periods/day   = {ReadableNumber(periods_per_day)}")
    print(f"periods/year  = {ReadableNumber(periods_per_year)}")
    print(f"size/period   = {convert_size(size_per_period)}")
    print(f"size/hour     = {convert_size(size_per_hour)}")
    print(f"size/day      = {convert_size(size_per_day)}")
    print(f"size/year     = {convert_size(size_per_year)}")

    def estimate_partitions(title: str, data_partitions: int):
        print(f"---------------------< Data Partition: {title}>------------------------")
        data_partitions_per_period = data_partitions
        data_partitions_per_hour = data_partitions_per_period * periods_per_hour
        data_partitions_per_day = 24 * data_partitions_per_hour
        data_partitions_per_year = 365 * data_partitions_per_day
        event_per_partition = events_per_year / data_partitions_per_year
        size_per_partition = event_per_partition * event_size
        print(f"partitions/period= {ReadableNumber(data_partitions_per_period, precision=1)}")
        print(f"partitions/hour  = {ReadableNumber(data_partitions_per_hour, precision=1)}")
        print(f"partitions/day   = {ReadableNumber(data_partitions_per_day, precision=1)}")
        print(f"partitions/year  = {ReadableNumber(data_partitions_per_year, precision=1)}")
        print(f"events/partition = {ReadableNumber(event_per_partition, precision=1)}")
        print(f"size/partition   = {convert_size(size_per_partition)}")

    estimate_partitions("by collector", collector_count)
    estimate_partitions("by vehicle group",  10)
    estimate_partitions(f"by geohash(5)", estimate_geohash_partitions(area_widh_km, area_height_km, 5))
    estimate_partitions(f"by geohash(6)", estimate_geohash_partitions(area_widh_km, area_height_km, 6))


if __name__ == "__main__":
    estimate(
        vehicle_count = 15000,
        refresh_interval_in_secs = 5,
        area_widh_km = 50,
        area_height_km = 20,
        period_in_min = 10,
        collector_count = 5,
        event_size = 20)
