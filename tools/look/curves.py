"""not a colour: tone-curve coefficients

ACES and AgX match the Three.js r163 chunk in the Zone B page (`tonemapping_pars_fragment`).
Every number here is a curve or a colour-space matrix coefficient, not a tint.
"""
import numpy as np

# mat3 columns, so M @ rgb matches GLSL `mat3(col0, col1, col2) * color`.
ACES_IN = np.array([
    [0.59719, 0.35458, 0.04823],
    [0.07600, 0.90834, 0.01566],
    [0.02840, 0.13383, 0.83777],
], float)
ACES_OUT = np.array([
    [1.60475, -0.53108, -0.07367],
    [-0.10208, 1.10813, -0.00605],
    [-0.00327, -0.07276, 1.07602],
], float)
SRGB_TO_REC2020 = np.array([
    [0.6274, 0.3293, 0.0433],
    [0.0691, 0.9195, 0.0880],
    [0.0164, 0.0113, 0.8956],
], float)
REC2020_TO_SRGB = np.array([
    [1.6605, -0.5876, -0.0728],
    [-0.1246, 1.1329, -0.1006],
    [-0.0182, -0.0083, 1.1187],
], float)
AGX_INSET = np.array([
    [0.856627153315983, 0.0951212405381588, 0.0482516061458583],
    [0.137318972929847, 0.761241990602591, 0.101439036467562],
    [0.11189821299995, 0.0767994186031903, 0.811302368396859],
], float)
AGX_OUTSET = np.array([
    [1.1271005818144368, -0.11060664309660323, -0.016493938717834573],
    [-0.1413297634984383, 1.157823702216272, -0.016493938717834257],
    [-0.14132976349843826, -0.11060664309660294, 1.2519364065950405],
], float)
AGX_MIN_EV = -12.47393
AGX_MAX_EV = 4.026069


def _sat(x):
    return np.clip(x, 0.0, 1.0)


def _rrt_odt(v):
    a = v * (v + 0.0245786) - 0.000090537
    b = v * (0.983729 * v + 0.4329510) + 0.238081
    return a / b


def aces(color, exposure=1.0):
    """Linear sRGB in, linear display out (Three.js ACESFilmicToneMapping, before the sRGB encode)."""
    c = np.asarray(color, float) * (float(exposure) / 0.6)
    c = _rrt_odt(c @ ACES_IN.T)
    return _sat(c @ ACES_OUT.T)


def _agx_contrast(x):
    x2 = x * x
    x4 = x2 * x2
    return (15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4
            - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232)


def agx(color, exposure=1.0):
    """Linear sRGB in, display-referred out (Three.js AgXToneMapping, includes the 2.2 power)."""
    c = np.maximum(np.asarray(color, float) @ SRGB_TO_REC2020.T, 0.0) * float(exposure)
    c = np.maximum(c @ AGX_INSET.T, 1e-10)
    c = np.log2(c)
    c = np.clip((c - AGX_MIN_EV) / (AGX_MAX_EV - AGX_MIN_EV), 0.0, 1.0)
    c = _agx_contrast(c) @ AGX_OUTSET.T
    c = np.power(np.maximum(c, 0.0), 2.2)
    return c @ REC2020_TO_SRGB.T


def apply_curve(name, color, exposure=1.0):
    if name == "aces":
        return srgb_encode(aces(color, exposure))
    if name == "agx":
        return np.clip(agx(color, exposure), 0.0, 1.0)
    raise ValueError(name)


def srgb_encode(lin):
    lin = np.clip(lin, 0.0, 1.0)
    return np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1.0 / 2.4) - 0.055)
