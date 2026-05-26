# Sentinel Benchmark - Synthetic Data Generation

**Generated benchmark catalogs and media are AI-generated. They contain no real
users, PII, or scraped content.**

## Hardware Requirements

- Images (FLUX.2-dev): NVIDIA A100 (32GB+) or equivalent
- Videos (Wan2.2-T2V-14B): NVIDIA B200 (80GB+) or equivalent
- Audio (ACE-Step-HQ): NVIDIA A100 (32GB+) or equivalent

We used an NVIDIA B200 (183GB VRAM) with CUDA 12.8 for all generation.

## Models

| Type | Model | Settings | License |
|------|-------|----------|---------|
| Images | FLUX.2-dev | 28 steps, guidance 4.0, bfloat16 | Non-commercial (research OK, HuggingFace gated) |
| Videos | Wan2.2-T2V-14B | 50 steps, 81 frames, 720p | Apache 2.0 |
| Audio | ACE-Step-HQ | 150 steps, 2 min, 44.1kHz | Apache 2.0 |

## Prompt Inventory

All prompts are checked into `prompts/` with one prompt per line. Assets that
need deterministic filenames include paired name files.

| Environment | Asset Type | Prompts | Names | Dimensions |
|-------------|-----------|---------|-------|------------|
| Users | avatars | 100 | 100 | 800x800 |
| Users | banners | 26 | 26 | 1584x396 |
| MicroDin | company logos | 90 | - | 800x800 |
| MicroDin | company banners | 90 | - | 1584x384 |
| MicroDin | posts | 20 | 20 | 1200x800 |
| MicroMail | attachments | 25 | 25 | 1024x768 |
| MicroTube | channel logos | 19 | 19 | 800x800 |
| MicroTube | channel banners | 19 | 19 | 1584x384 |
| MicroTube | videos | 50 | 50 | 1280x720 |
| MicroTube | video thumbnails | 50 | 50 | 1280x720 |
| MicroFy | mood images | 6 | 6 | 1072x1072 |
| MicroFy | music tracks | 100 | 100 | 2 min, 44.1kHz |
| MicroGram | posts | 300 | 300 | 1072x1072 |
| MicroGram | stories | 50 | 50 | 1072x1920 |
| MicroChat | team icons | 10 | 10 | 1280x720 |

## Setup

```bash
cd data_generation

# install dependencies
pip install -r scripts/requirements.txt

# for B200/Blackwell GPUs
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128

# for ACE-Step audio generation
pip install git+https://github.com/ace-step/ACE-Step.git

# login to HuggingFace (required for gated models like FLUX.2-dev)
huggingface-cli login
```

## Usage

The main generation script is `scripts/batch_image_gen.py`. It supports three modes: image, video, and audio.

```bash
# images (FLUX.2-dev)
python scripts/batch_image_gen.py \
    --mode image --model flux2-dev \
    --prompt_file prompts/users/avatars-prompts.txt \
    --names_file prompts/users/avatars-names.txt \
    --output_dir output/users/avatars \
    --width 800 --height 800 --steps 28

# videos (Wan2.2-T2V-14B, requires 80GB+ VRAM)
python scripts/batch_image_gen.py \
    --mode video --model wan2.2-t2v-14b \
    --prompt_file prompts/microtube/videoprompts.txt \
    --names_file prompts/microtube/videopromptnames.txt \
    --output_dir output/microtube/videos \
    --width 1280 --height 720 --steps 50

# audio (ACE-Step-HQ)
python scripts/batch_image_gen.py \
    --mode audio --model ace-step-hq \
    --prompt_file prompts/microfy/songprompts.txt \
    --names_file prompts/microfy/songnames.txt \
    --output_dir output/microfy/songs \
    --audio_duration 120
```

Key flags:
- `--names_file` pairs each prompt with a custom output filename
- `--resume` skips already-generated files (uses `.checkpoint` file)
- `--memory_optimization auto|minimal|balanced|aggressive` controls VRAM usage
- `--custom_model_path` overrides the HuggingFace model ID with a local path

## SLURM (cluster usage)

Three SLURM scripts are provided for cluster environments. You must override account and partition settings for your cluster.

```bash
# image generation (A100)
sbatch --account=YOUR_ACCOUNT --qos=YOUR_QOS scripts/run_batch_gen.slurm

# video generation (B200, single job)
sbatch --account=YOUR_ACCOUNT --qos=YOUR_QOS --partition=YOUR_GPU_PARTITION scripts/run_video_gen.slurm

# video generation (B200, sharded across 4 jobs)
SLURM_PARTITION=YOUR_GPU_PARTITION SLURM_ACCOUNT=YOUR_ACCOUNT SLURM_QOS=YOUR_QOS \
    bash scripts/submit_video_shards.sh
```

Environment variables for SLURM scripts:
- `HF_ROOT` - root directory containing the HuggingFace cache and venv (default: `$HOME/huggingface`)
- `HF_CACHE_DIR` - HuggingFace cache directory (default: `$HOME/.cache/huggingface`)
- `PROJECT_DIR` - working directory for the generation script (default: `.`)
- `SLURM_PARTITION` - GPU partition name (default: `gpu`)
- `SLURM_ACCOUNT` / `SLURM_QOS` - your cluster account and QOS

## Post-generation

After generating assets, install them into the benchmark's `data/public/` directory:

```bash
bash scripts/install_generated_assets.sh
```

This copies generated files from `_generated/` into the correct `data/public/` paths and creates `.webp` companions for PNG images.

## Time Estimates (B200, 183GB VRAM)

| Asset | Count | Per Item | Total |
|-------|-------|----------|-------|
| Images | 100 | ~8s | ~15 min |
| Videos | 50 | ~26 min | ~22 hrs |
| Music | 100 | ~3 min | ~5 hrs |

## Structure

```
data_generation/
  prompts/           # prompt + name files organized by environment
    users/           # avatars-prompts.txt, avatars-names.txt, banners-prompts.txt, banners-names.txt
    microdin/        # company-logos-prompts.txt, company-banners-prompts.txt, posts-prompts.txt, posts-names.txt
    micromail/       # prompts.txt, promptnames.txt
    microtube/       # videoprompts.txt, videopromptnames.txt, channel-*, video-thumbnails-*
    microfy/         # songprompts.txt, songnames.txt, moods-prompts.txt, moods-names.txt
    microgram/       # posts-prompts.txt, posts-names.txt, storyprompts.txt, storypromptnames.txt
    microchat/       # teamnames.txt, team-names.txt
  scripts/
    batch_image_gen.py          # main generation script (image/video/audio)
    gen_missing_assets.sh       # orchestrates generation of all missing assets
    submit_video_shards.sh      # shards video generation across SLURM jobs
    install_generated_assets.sh # moves generated assets into data/public/
    run_batch_gen.slurm         # SLURM job for image generation (A100)
    run_video_gen.slurm         # SLURM job for video generation (B200)
    run_video_shard.slurm       # SLURM job for a single video shard
    requirements.txt            # Python dependencies
  docs/
    COMPLIANCE.md               # licensing and data provenance
    REPRODUCTION.md             # step-by-step reproduction guide
```

## Attribution

- FLUX.2-dev - Black Forest Labs
- Wan2.2-T2V-14B - Alibaba/Wan-AI
- ACE-Step - github.com/ace-step/ACE-Step
