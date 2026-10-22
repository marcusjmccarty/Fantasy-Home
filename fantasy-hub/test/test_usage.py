import importlib.util, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('usage',Path(__file__).parents[1]/'scripts'/'build_usage.py')
usage=importlib.util.module_from_spec(spec);spec.loader.exec_module(usage)

def play(pid='a',kind='run',yard=20,play_id='1',week='1',**extra):
    return {'season_type':'REG','week':week,'posteam':'CHI','game_id':'2026_01_CHI_DET','play_id':play_id,'play_type':kind,'yardline_100':str(yard),'rush_attempt':'1' if kind=='run' else '0','pass_attempt':'1' if kind=='pass' else '0','rusher_player_id':pid if kind=='run' else '', 'receiver_player_id':pid if kind=='pass' else '',**extra}

class UsageTests(unittest.TestCase):
    def test_redzone_boundaries_and_touch_types(self):
        rows=[play(yard=20),play(kind='pass',yard=10,play_id='2',complete_pass='1'),play(yard=5,play_id='3'),play(yard=21,play_id='4')]
        p=usage.aggregate(rows)['players'][0]['weeks']['1']
        self.assertEqual(p['carries'],3);self.assertEqual(p['targets'],1);self.assertEqual(p['receptions'],1)
        self.assertEqual(p['redzone_carries'],2);self.assertEqual(p['inside10_carries'],1);self.assertEqual(p['inside5_carries'],1)
        self.assertEqual(p['inside10_targets'],1);self.assertEqual(p['inside5_targets'],0)
    def test_full_team_denominator_includes_other_players(self):
        data=usage.aggregate([play(),play(pid='b',play_id='2')]);p=data['players'][0]['weeks']['1']
        self.assertEqual(p['carries'],1);self.assertEqual(p['team_totals']['carries'],2)
    def test_duplicate_plays_penalties_kneels_spikes_and_conversions_excluded(self):
        rows=[play(),play(),play(kind='no_play',play_id='2'),play(play_id='3',qb_kneel='1'),play(kind='pass',play_id='4',qb_spike='1'),play(play_id='5',two_point_attempt='1'),play(play_id='6',season_type='POST')]
        data=usage.aggregate(rows);self.assertEqual(data['players'][0]['weeks']['1']['carries'],1)
    def test_zero_is_observed_and_absent_yardline_is_not_redzone(self):
        p=usage.aggregate([play(yard='')])['players'][0]['weeks']['1'];self.assertEqual(p['redzone_carries'],0)
    def test_identity_crosswalk_and_team_changes_keep_week_denominators(self):
        rows=[play(),play(week='2',posteam='GB',game_id='2026_02_GB_MIN')]
        data=usage.aggregate(rows,{'a':{'name':'Test Player','position':'RB','espn_id':'42'}})
        p=data['players'][0];self.assertEqual(p['espn_id'],'42');self.assertEqual(p['name'],'Test Player');self.assertEqual(p['weeks']['2']['team'],'GB')
        self.assertEqual(data['through_week'],2)

if __name__=='__main__':unittest.main()
