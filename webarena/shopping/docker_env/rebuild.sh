arg="${1:-}"   # optional argument; empty string if not provided

docker stop shopping
docker container rm shopping
docker build --build-arg BUILD_DATE=$(date +%F) -t shopping-sentinel:latest .

if [[ "$arg" == "start" ]]; then
    docker run --env-file .env --name shopping -p 7770:80 -p 8000:8000 -v $(pwd):/mnt/workspace -d shopping-sentinel
    
    # Sleep for 1 minute to allow servies to start
    sleep 60
    docker exec shopping /var/www/magento2/bin/magento setup:store-config:set --base-url="http://localhost:7770" # no trailing slash
    docker exec shopping mysql -u magentouser -pMyPassword magentodb -e  'UPDATE core_config_data SET value="http://localhost:7770/" WHERE path = "web/secure/base_url";'
    docker exec shopping /var/www/magento2/bin/magento cache:flush
fi