import unittest, numpy as np
from PIL import Image
import starmip as M
P = '/workspace/zd-bible-1012/zd-plates/sky12/zd-sky12-S00-final5.jpg'; R = (0, 420, 1280, 715); MAG = 0.7359

class T(unittest.TestCase):
    @classmethod
    def setUpClass(c):
        c.b = np.asarray(Image.open(P).convert('RGB'), np.float32) / 255
        c.base = M.star_check(c.b, None, MAG, R)[0]
        c.box = M.compare(c.b, M.mip1_box(c.b), MAG, R, c.base)[0]
        c.star = M.compare(c.b, M.mip1_star(c.b), MAG, R, c.base)[0]
    def test_box_fails(self): self.assertEqual(self.box['verdict'], 'FAIL')
    def test_star_beats_box(self): self.assertGreater(self.star['median_peak_ratio'], self.box['median_peak_ratio'] + 0.1)
    def test_star_as_good_as_no_mip(self): self.assertGreaterEqual(self.star['median_peak_ratio'], self.base['median_peak_ratio'] - 0.01)
    def test_star_keeps_background(self): self.assertLess(abs(self.star['bg_mean_screen'] - self.star['bg_mean_base']), 0.01)
    def test_identity_at_1x_passes(self):
        r = M.star_check(self.b, None, 1.0, R, phase=0.5)[0]; self.assertEqual(r['verdict'], 'PASS')
    def test_box_ratio_about_079(self): self.assertAlmostEqual(self.box['peak_vs_nomip'], 0.79, delta=0.02)
    def test_star_passes_vs_nomip(self):
        self.assertEqual(self.star['verdict'], 'PASS'); self.assertGreaterEqual(self.star['peak_vs_nomip'], 0.97)
        self.assertLessEqual(self.star['median_size_px'], 2.0); self.assertLessEqual(self.star['bg_drift_vs_nomip'], 0.01)

if __name__ == '__main__': unittest.main()
