# WebArena Forum Environment (aka 'Reddit', aka 'Postmill')

### Download and load the latest image:

```bash
wget http://metis.lti.cs.cmu.edu/webarena-images/postmill-populated-exposed-withimg.tar
docker load < postmill-populated-exposed-withimg.tar
```

#### Run the image (assiging the nick-name `forum`):

```
docker run --name forum -p 9999:80 -v $(pwd):/mnt/workspace -d postmill-populated-exposed-withimg
```

You can now connect to the forum in a browser, either at http://localhost:9999, or use the hostname of the GCR machine (if applicable).

### Connect to the image with an interactive terminal:

```
exec -it forum sh
```


### Install Python in the container:

*Within the docker intractive terminal,* run the following:

```
cd /mnt/workspace
bash install_python.bash
```

### Dump the necessary tables to JSON: 

*Within the docker intractive terminal,* run the following:

(This will take a while)

```
python3 dump_table.py submissions > submissions.jsonl
python3 dump_table.py comments > comments.jsonl
```


### Run the script to populate the data over time:

*Within the docker intractive terminal,* run the following:
 

```
python3 populate_subs.py
```

Refreshing the postmill site in the browser will then show the data getting populated.

E.g., http://localhost:9999/all/active
