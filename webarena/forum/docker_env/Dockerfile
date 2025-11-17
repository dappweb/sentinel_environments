# Dockerfile
FROM postmill-populated-exposed-withimg

# Install Python and postgresql bindings
RUN apk upgrade --no-cache python3
RUN apk add --no-cache build-base python3-dev postgresql-dev
RUN python3 -m ensurepip
RUN pip3 install --no-cache --upgrade pip setuptools && pip3 install psycopg2 fastapi uvicorn

# (Optional) install vim
RUN apk add --no-cache vim

# Prepare the database
COPY prepare_database.sql /var/www/html/prepare_database.sql
COPY dump_table.py /var/www/html/dump_table.py
USER postgres
ENV PGDATA=/usr/local/pgsql/data

# Start Postgres, run SQL, stop Postgres
RUN pg_ctl -D "$PGDATA" -o "-c listen_addresses=''" -w start \
    && python3 dump_table.py submissions > submissions.jsonl \
    && python3 dump_table.py comments > comments.jsonl \
    && psql -d postmill -f /var/www/html/prepare_database.sql \
    && pg_ctl -D "$PGDATA" -m fast -w stop 
USER root

# Patch Postmill
COPY SubmissionPage.php /var/www/html/src/Pagination/SubmissionPage.php

# Copy the sentinel server
COPY sentinel_api.py /var/www/html/sentinel_api.py
