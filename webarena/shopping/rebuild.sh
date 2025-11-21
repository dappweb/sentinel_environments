# TODO: needs updated 
arg="${1:-}"   # optional argument; empty string if not provided

docker stop forum
docker container rm forum
docker build -t shopping_final_0712:latest .

if [[ "$arg" == "start" ]]; then
    docker run --name forum -p 9999:80 -p 8000:8000 -v $(pwd):/mnt/workspace -d shopping_final_0712
fi