while true; do
    docker run --rm --name shopping -p 9999:80 -p 8000:8000 -v $(pwd):/mnt/workspace -d shopping-sentinel
    docker wait shopping
    sleep 1 
done	
