set -e
rm -rf output
mkdir -p output
docker-compose up

# docker run -p 4222:4222 -p 4243:4243 -p 8222:8222 -v `pwd`/event-hub/config.txt:/etc/nats/nats-server.conf nats
# docker run -p 3000:3000 vehicles-viewer
# docker run -p 7720:7720 -v `pwd`/output:/apps/output -e COLLECTOR_INSTANCES=1 vehicles-collector
# docker run -p 7730:7730 -v `pwd`/output:/apps/output -e FINDER_INSTANCES=1 vehicles-finder
# docker run -p 7710:7710 -e COLLECTOR_INSTANCES=1 -e GENERATOR_INSTANCES=1 vehicles-generator
