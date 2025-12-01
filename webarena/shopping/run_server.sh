while true; do
    docker run --rm --name shopping -p 7770:80 -p 8000:8000 -v $(pwd):/mnt/workspace -d shopping-sentinel
    docker wait shopping
    
    sleep 60
    docker exec shopping /var/www/magento2/bin/magento setup:store-config:set --base-url="http://localhost:7770" # no trailing slash
    docker exec shopping mysql -u magentouser -pMyPassword magentodb -e  'UPDATE core_config_data SET value="http://localhost:7770/" WHERE path = "web/secure/base_url";'
    docker exec shopping /var/www/magento2/bin/magento cache:flush
done