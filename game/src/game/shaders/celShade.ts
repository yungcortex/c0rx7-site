import {
  Scene,
  Camera,
  DefaultRenderingPipeline,
  ImageProcessingConfiguration,
  Color4,
  SSAO2RenderingPipeline,
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

  // Try SSAO2 — gracefully bail on platforms that don't support it
  try {
    const ssao = new SSAO2RenderingPipeline(
      "aetherwake-ssao",
      scene,
      0.75,
      [camera],
    );
    ssao.radius = 1.4;
    ssao.totalStrength = 1.0;
    ssao.expensiveBlur = false;
    ssao.samples = 8;
    ssao.maxZ = 200;
  } catch (e) {
    // SSAO2 needs WebGL2; fallback platforms just go without
    console.info("[celShade] SSAO2 unavailable; continuing without ambient occlusion");
  }

  return pipeline;
}
