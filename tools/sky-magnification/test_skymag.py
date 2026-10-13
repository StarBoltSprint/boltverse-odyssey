import copy, unittest
import skymag as S

class T(unittest.TestCase):
    def one(self, **kw):
        c = copy.deepcopy(S.DEFAULTS); c.update(kw)
        return S.eval_pose(c, dict(name='t', s=0, yaw=15, pitch=c['pitch'], cam_y=2.6))
    def test_known_good_passes(self):
        # 2x buffer (dpr-3 class phone at scale 2) with a 30 deg FOV: far above 1x
        r = self.one(css=[412, 915], render_scale=2.0, vfov=30.0)
        self.assertGreaterEqual(r['min_mag'], 1.0)
    def test_wider_fov_fails(self):
        r = self.one(vfov=90.0, render_scale=2.0); self.assertLess(r['min_mag'], 1.0)
    def test_smaller_buffer_fails(self):
        r = self.one(css=[206, 457], render_scale=1.0, vfov=30.0); self.assertLess(r['min_mag'], 1.0)
    def test_centre_is_minimum_at_level_pitch(self):
        r = self.one(pitch=0.0)
        self.assertTrue(r['region'].endswith('centre'))
    def test_analytic_centre(self):
        # at the horizon centre mag = f*pi/180 / (plate_w/hfov)
        import math
        c = S.DEFAULTS; W, H = S.buffer_size(c)
        f = H / 2 / math.tan(math.radians(c['vfov'] / 2))
        exp = f * math.pi / 180 / (c['plate_w'] / c['plate_hfov'])
        r = self.one(pitch=0.0); self.assertAlmostEqual(r['min_mag'], exp, delta=0.01)
    def test_gate_verdict_fail_reports_where(self):
        c = copy.deepcopy(S.DEFAULTS); c.update(vfov=90.0, spine_len=10)
        r = S.run(c); self.assertEqual(r['verdict'], 'FAIL')
        for k in ('region', 'plate', 'pose'): self.assertIn(k, r['global_min'])

if __name__ == '__main__': unittest.main()
