use geo::{Geometry, BoundingRect, Intersects, coord };
use geohash::{encode, decode_bbox};
use std::collections::HashSet;

pub fn geohash_covering(geom: &Geometry<f64>, precision: usize) -> HashSet<String> {
    let bbox = geom.bounding_rect().unwrap();
    let min = bbox.min();
    let max = bbox.max();

    // On prend le centre du bbox pour calculer la taille d’un geohash de niveau 5
    let center = coord!( x: (min.x + max.x) / 2.0, y: (min.y + max.y) / 2.0 );
    let sample_hash = encode(center, precision).unwrap();
    let sample_bbox = decode_bbox(&sample_hash).unwrap();
    let step_lon = sample_bbox.max().x - sample_bbox.min().x;
    let step_lat = sample_bbox.max().y - sample_bbox.min().y;

    let mut hashes = HashSet::new();

    let mut lat = min.y;
    while lat <= max.y {
        let mut lon = min.x;
        while lon <= max.x {
            let hash = encode(coord!(x: lon, y: lat), precision).unwrap();
            let gh_bbox = decode_bbox(&hash).unwrap();
            let gh_poly = geo::Rect::new(
                coord! { x: gh_bbox.min().x, y: gh_bbox.min().y },
                coord! { x: gh_bbox.max().x, y: gh_bbox.max().y },
            ).to_polygon();
            if geom.intersects(&gh_poly) {
                hashes.insert(hash);
            }
            lon += step_lon;
        }
        lat += step_lat;
    }
    hashes
}


