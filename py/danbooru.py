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
LATEST_PATH = os.path.join(JSON_DIR_PATH, "all.latest.json")
DATA_PATH = os.path.join(JSON_DIR_PATH, "all.json")

REPO_URL = "https://github.com/shinich39/danbooru-tags-json"
LATEST_URL = "https://raw.githubusercontent.com/shinich39/danbooru-tags-json/refs/heads/main/dist/all.latest.json"
DATA_URL = "https://raw.githubusercontent.com/shinich39/danbooru-tags-json/refs/heads/main/dist/all.json"

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
    
  # Save all.latest.json
  with open(LATEST_PATH, "w") as f:
    f.write(json.dumps(remote_data))
    f.close()
  
  # Download all.json
  print(f"[comfyui-mtga] New update available: {local_time} < {remote_time}")
  print(f"[comfyui-mtga] Downloading all.json...")

  try:
    res = requests.get(DATA_URL)
    data = json.loads(res.text)
    with open(DATA_PATH, "w") as f:
      f.write(json.dumps(data))
      f.close()

    print(f"[comfyui-mtga] all.json has been downloaded.")

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

@PromptServer.instance.routes.get("/shinich39/comfyui-mtga/load")
async def _load(request):
  try:
    tags = get_data()

    return web.json_response({
      "tags": tags
    })
  except Exception:
    print(traceback.format_exc())
    return web.Response(status=400)