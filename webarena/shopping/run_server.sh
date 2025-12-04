while true; do
    if [ -z "$(docker ps --filter "name=shopping" --format '{{.Names}}')" ]; then
        sleep 5

        echo "Starting shopping container..."
        docker run --rm --env-file docker_env/.env --name shopping -p 7770:80 -p 8000:8000 -v $(pwd):/mnt/workspace -d shopping-sentinel
    
        # Sleep for 1 minute to allow services to start
        echo "Sleeping for 60 seconds to allow services to start..." 
        sleep 60

        HOSTNAME="$(hostname -f).redmond.corp.microsoft.com"
        echo "Configuring base URL to http://$HOSTNAME:7770"
        docker exec shopping /var/www/magento2/bin/magento setup:store-config:set --base-url="http://$HOSTNAME:7770" # no trailing slash
        docker exec shopping mysql -u magentouser -pMyPassword magentodb -e  "UPDATE core_config_data SET value=\"http://$HOSTNAME:7770/\" WHERE path = \"web/secure/base_url\";"
        docker exec shopping /var/www/magento2/bin/magento cache:flush

        # Wait for the container to stop
        docker wait shopping

        echo "Container exited. Restarting..."
    else
        echo "Shopping container is already running. Retrying in 5 seconds..."
        sleep 5
    fi
done