import {
  Scene,
  Camera,
  DefaultRenderingPipeline,
  ImageProcessingConfiguration,
  Color4,
} from "@babylonjs/core";

/**
 * Painterly post-process: vignette, mild bloom, color grading toward warm
 * shadows + cool highlights. The 2-band cel shading + outline pass is
 * tracked for Phase 0 task #6 — this function currently sets up the
 * pipeline that the stylized shaders will plug into.
 */
export function applyCelShade(scene: Scene, camera: Camera): DefaultRenderingPipeline {
  const pipeline = new DefaultRenderingPipeline(
    "aetherwake-pipeline",
    true,
    scene,
    [camera],
  );

  pipeline.samples = 4;
  pipeline.fxaaEnabled = true;

  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.6;
  pipeline.bloomWeight = 0.35;
  pipeline.bloomKernel = 64;
  pipeline.bloomScale = 0.5;

  pipeline.imageProcessingEnabled = true;
  const ip = pipeline.imageProcessing;
  ip.toneMappingEnabled = true;
  ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.exposure = 1.05;
  ip.contrast = 1.15;

  ip.vignetteEnabled = true;
  ip.vignetteWeight = 2.5;
  ip.vignetteStretch = 0.4;
  ip.vignetteColor = new Color4(0.05, 0.02, 0.08, 0);
  ip.vignetteCameraFov = 0.5;

  ip.colorGradingEnabled = false;

  return pipeline;
}
