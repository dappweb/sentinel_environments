# Dockerfile
FROM shopping_final_0712

# Install Python and postgresql bindings
RUN apk upgrade --no-cache python3
RUN apk add --no-cache build-base python3-dev postgresql-dev
RUN python3 -m ensurepip
RUN pip3 install --no-cache --upgrade pip setuptools && pip3 install fastapi uvicorn

# Run the code to generate the set of product and sales events
COPY generate_events.py /var/www/html/generate_events.py
COPY product_sales.py /var/www/html/product_sales.py
COPY products.py /var/www/html/products.py
COPY auth.py /var/www/html/auth.py
COPY store_requests.py /var/www/html/store_requests.py
RUN python3 /var/www/html/generate_events.py --num-products 10 --num-sales 10

# Copy the sentinel server
COPY sentinel_api.py /var/www/html/sentinel_api.py
COPY fastapi.ini /etc/supervisor.d/fastapi.ini