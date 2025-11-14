export PYTHONUNBUFFERED=1
apk add --update --no-cache python3 
apk add --update --no-cache build-base
apk add --update --no-cache python3-dev
apk add --update --no-cache postgresql-dev
ln -sf python3 /usr/bin/python
python3 -m ensurepip
pip3 install --no-cache --upgrade pip setuptools
pip install psycopg2
