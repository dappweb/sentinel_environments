while true; do
    docker run --rm --name forum -p 9999:80 -p 8000:8000 -v $(pwd):/mnt/workspace -d postmill-sentinel
    docker wait forum
    sleep 1 
done	
