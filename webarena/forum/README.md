# WebArena Forum Environment (aka 'Reddit', aka 'Postmill')

### Download and load the latest image:

```bash
wget http://metis.lti.cs.cmu.edu/webarena-images/postmill-populated-exposed-withimg.tar
docker load < postmill-populated-exposed-withimg.tar
```

Locally-hosted copies of the image are also available [here](https://microsoft-my.sharepoint.com/:f:/p/adamfo/IgBrTH551q7cRZOEdsoBCL_XASH4WMxp4DAymXZbu0McIBg?e=btI5cE).

#### Run the image (assiging the nick-name `forum`):

```
docker run --name forum -p 9999:80 -v $(pwd):/mnt/workspace -d postmill-populated-exposed-withimg
```

You can now connect to the forum in a browser, either at http://localhost:9999, or use the hostname of the GCR machine (if applicable).

### Connect to the image with an interactive terminal:

```
docker exec -it forum sh
```


### Install Python in the container:

*Within the docker intractive terminal,* run the following:

```
cd /mnt/workspace
bash install_python.bash
```

### Dump the necessary tables to JSON: 

This step can take a while to run. Pre-computed dumps are available [here](https://microsoft-my.sharepoint.com/:f:/p/adamfo/IgDFkqI9GfLdT6dTnuCNB26mAVGNWhnk0NHxDsQxl1etFf0?e=KrnVdf).

*Within the docker intractive terminal,* run the following:

```
python3 dump_table.py submissions > submissions.jsonl
python3 dump_table.py comments > comments.jsonl
python3 gen_votes.py < submissions.jsonl > submission_votes.jsonl
```


### Run the script to populate the data over time:

*Within the docker intractive terminal,* run the following:
 

```
python3 populate_subs.py
```

Refreshing the postmill site in the browser will then show the data getting populated.

E.g., http://localhost:9999/all/active
