import os
import json
import hashlib
import traceback
import requests
import gzip
import io
import folder_paths

from server import PromptServer
from aiohttp import web

__DIRNAME = os.path.dirname(os.path.abspath(__file__))

JSON_DIR_PATH = os.path.join(__DIRNAME, "..", "data")
LATEST_PATH = os.path.join(JSON_DIR_PATH, "civitai.latest.json")
DATA_PATH = os.path.join(JSON_DIR_PATH, "civitai.json")

REPO_URL = "https://github.com/shinich39/civitai-model-json"
LATEST_URL = "https://raw.githubusercontent.com/shinich39/civitai-model-json/refs/heads/main/dist/latest.json"
DATA_URL = "https://raw.githubusercontent.com/shinich39/civitai-model-json/refs/heads/main/dist/most-used-words.json"

def get_remote_latest():
  try:
    res = requests.get(LATEST_URL)
    data = json.loads(res.text)
    return data
  except Exception:
    return None
  
def get_local_latest():
  try:
    if os.path.exists(LATEST_PATH) == True:
      with open(LATEST_PATH, "r") as f:
        return json.load(f)
  except Exception:
    return None

def get_data():
  print(f"[comfyui-mtga] Update civitai-model-json...")

  if os.path.exists(JSON_DIR_PATH) == False:
    os.mkdir(JSON_DIR_PATH)

  # Check updates
  local_data = get_local_latest()
  remote_data = get_remote_latest()

  remote_time = None
  if remote_data != None and "updatedAt" in remote_data:
    remote_time = remote_data["updatedAt"]

  local_time = None
  if local_data != None and "updatedAt" in local_data:
    local_time = local_data["updatedAt"]

  is_updated = os.path.exists(DATA_PATH) == False or local_time != remote_time

  if is_updated == False:
    with open(DATA_PATH, "r") as file:
      print(f"[comfyui-mtga] No updates found: {local_time} = {remote_time}")
      return json.load(file)
    
  # Save latest.json
  with open(LATEST_PATH, "w") as f:
    f.write(json.dumps(remote_data))
    f.close()
  
  # Download most-used-words.json
  print(f"[comfyui-mtga] New update available: {local_time} < {remote_time}")
  print(f"[comfyui-mtga] Downloading most-used-words.json...")

  try:
    res = requests.get(DATA_URL)

    # print(f"[comfyui-civitai-workflow] Decompressing checkpoints.json.gz...")
    # with gzip.GzipFile(fileobj=io.BytesIO(res.content)) as f:
    #   decompressed_data = f.read()
    # text = decompressed_data.decode('utf-8')

    data = json.loads(res.text)

    with open(DATA_PATH, "w") as f:
      f.write(json.dumps(data))
      f.close()

    print(f"[comfyui-mtga] most-used-words.json has been downloaded.")

    return data
  except Exception:
    print(traceback.format_exc())
    print(f"[comfyui-mtga] Failed to download.")

    try:
      if os.path.exists(DATA_PATH) == True:
        with open(DATA_PATH, "r") as file:
          return json.load(file)
    except:
      pass

    return []

@PromptServer.instance.routes.get("/shinich39/comfyui-mtga/get-civitai-tags")
async def _get(request):
  try:
    tags = get_data()

    return web.json_response({
      "tags": tags
    })
  except Exception:
    print(traceback.format_exc())
    return web.Response(status=400)