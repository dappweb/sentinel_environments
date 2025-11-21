# Dockerfile
FROM shopping_final_0712

# Install system dependencies
RUN apk update
RUN apk update --no-cache \
    bash \
    curl \
    unzip \
    wget
RUN apk update --no-cache \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont
RUN apk update --no-cache chromium \
    chromium-chromedriver
RUN apk update python3
RUN apk update --no-cache build-base python3-dev
RUN python3 -m ensurepip
RUN pip3 install --no-cache --upgrade pip setuptools && pip3 install fastapi uvicorn requests openai
RUN pip3 install selenium chromedriver-py

# Run the code to generate the set of product and sales events
COPY generate_events.py /var/www/html/generate_events.py
COPY product_sales.py /var/www/html/product_sales.py
COPY products.py /var/www/html/products.py
COPY auth.py /var/www/html/auth.py
COPY store_requests.py /var/www/html/store_requests.py
COPY product_images/* /var/www/html/product_images/
# RUN python3 /var/www/html/generate_events.py --num-products 10 --num-sales 10
# RUN gzip /var/www/html/events.jsonl -c > /var/www/html/events.jsonl.gz

# Copy the sentinel server
COPY sentinel_api.py /var/www/html/sentinel_api.py
COPY fastapi.ini /etc/supervisor.d/fastapi.ini