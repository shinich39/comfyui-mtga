import traceback
import folder_paths

from server import PromptServer
from aiohttp import web

CHECKPOINTS = (
  *folder_paths.get_filename_list("checkpoints"),
  *folder_paths.get_filename_list("diffusion_models"),
)

CLIPS = (
  *folder_paths.get_filename_list("clip"),
  *folder_paths.get_filename_list("clip_vision"),
)

LORAS = (
  *folder_paths.get_filename_list("loras"),
)

VAES = (
  *folder_paths.get_filename_list("vae"),
  *folder_paths.get_filename_list("vae_approx"),
)

EMBEDDINGS = (
  *folder_paths.get_filename_list("embeddings"),
)

@PromptServer.instance.routes.get("/shinich39/comfyui-mtga/get-local-models")
async def _get(request):
  try:
    return web.json_response({
      "checkpoints": CHECKPOINTS,
      "clips": CLIPS,
      "loras": LORAS,
      "vaes": VAES,
      "embeddings": EMBEDDINGS,
    })
  except Exception:
    print(traceback.format_exc())
    return web.Response(status=400)