## TEST AGENT PROMPT – IMAGE INTEGRATION RULES ##
- Always use base64-encoded images for all tests and requests.
- Accepted formats: JPEG, PNG, WEBP only. No SVG, BMP, HEIC.
- Do not upload blank, solid-color, or uniform-variance images; images must contain real visual features.
- If not PNG/JPEG/WEBP, transcode first and re-detect MIME after transformations.
- Animated images: first frame only. Resize large images to reasonable bounds.
