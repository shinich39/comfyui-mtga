"""
@author: shinich39
@title: comfyui-mtga
@nickname: comfyui-mtga
@version: 1.0.33
@description: Make Textarea Great Again
"""

from .py import danbooru, civitai, model

NODE_CLASS_MAPPINGS = {}

NODE_DISPLAY_NAME_MAPPINGS = {}

WEB_DIRECTORY = "./js"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]