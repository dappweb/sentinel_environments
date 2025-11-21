# TODO: needs updated 
arg="${1:-}"   # optional argument; empty string if not provided

docker stop shopping
docker container rm shopping
docker build -t shopping:latest .

if [[ "$arg" == "start" ]]; then
    docker run --name shopping -p 9999:80 -p 8000:8000 -v $(pwd):/mnt/workspace -d shopping
    docker exec shopping /var/www/magento2/bin/magento setup:store-config:set --base-url="http://<your-server-hostname>:7770" # no trailing slash
    docker exec shopping mysql -u magentouser -pMyPassword magentodb -e  'UPDATE core_config_data SET value="http://<your-server-hostname>:7770/" WHERE path = "web/secure/base_url";'
    docker exec shopping /var/www/magento2/bin/magento cache:flush
fi