from huggingface_hub import snapshot_download

snapshot_download(
    repo_id="microsoft/Florence-2-base",
    local_dir="./models/florence2",
    local_dir_use_symlinks=False
)

print("Download complete")
