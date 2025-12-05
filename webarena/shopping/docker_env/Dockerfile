# Dockerfile
FROM shopping_final_0712

# Sets the port for the Adobe Commerce store URL 
ENV MAGENTO_PORT=80
ENV MAGENTO_URL=localhost

# Install system dependencies
RUN apk update
RUN apk update --no-cache \
    bash \
    curl \
    unzip \
    wget

# Install Python 3 and pip
RUN apk update python3
RUN apk update --no-cache build-base python3-dev
RUN python3 -m ensurepip

# Install required Python packages
RUN pip3 install --no-cache --upgrade pip setuptools && pip3 install fastapi uvicorn requests openai beautifulsoup4

# Copy scripts for event generation
COPY generate_events.py /var/www/html/generate_events.py
COPY product_sales.py /var/www/html/product_sales.py
COPY products.py /var/www/html/products.py
COPY auth.py /var/www/html/auth.py
COPY store_requests.py /var/www/html/store_requests.py
COPY completions.py /var/www/html/completions.py
COPY reviews.py /var/www/html/reviews.py
COPY .env /var/www/html/.env
COPY events.jsonl.gz /var/www/html/events.jsonl.gz
COPY product_images.tar.gz /var/www/html/product_images.tar.gz
RUN tar -xzf /var/www/html/product_images.tar.gz -C /var/www/html/

# Copy the sentinel server
COPY sentinel_api.py /var/www/html/sentinel_api.py
COPY fastapi.ini /etc/supervisor.d/fastapi.ini
