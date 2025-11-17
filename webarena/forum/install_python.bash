export PYTHONUNBUFFERED=1
apk upgrade --no-cache python3 
apk add --no-cache build-base
apk add --no-cache python3-dev
apk add --no-cache postgresql-dev
apk add --no-cache vim
python3 -m ensurepip
pip3 install --no-cache --upgrade pip setuptools
pip install psycopg2
