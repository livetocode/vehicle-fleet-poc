set -e
# docker build --build-arg APP=generator -t vehicles-generator -f .docker/nodejs.Dockerfile .
# docker build --build-arg APP=collector -t vehicles-collector -f .docker/nodejs.Dockerfile .
# docker build --build-arg APP=finder -t vehicles-finder -f .docker/nodejs.Dockerfile .
# docker build --build-arg APP=viewer -t vehicles-viewer -f .docker/nodejs.Dockerfile .
docker-compose build
