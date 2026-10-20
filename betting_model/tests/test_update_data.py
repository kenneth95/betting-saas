import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import pytest

from betting_model.config import League
from update_data import season_slug, update_current_season

GOOD_CSV = (
    "Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR,B365H,B365D,B365A\n"
    "E0,15/08/2026,Arsenal,Chelsea,2,1,H,1.9,3.5,4.0\n"
    "E0,16/08/2026,Man City,Fulham,3,0,H,1.2,6.5,12.0\n"
).encode()


class FakeResp:
    def __init__(self, content, status=200):
        self.content, self.status = content, status
    def raise_for_status(self):
        if self.status >= 400:
            raise RuntimeError(f"HTTP {self.status}")


class FakeSession:
    def __init__(self, resp): self.resp, self.urls = resp, []
    def get(self, url, **kw):
        self.urls.append(url)
        return self.resp


def _league(tmp_path):
    return League(code="epl", name="EPL", data_folder=str(tmp_path), football_data_code="E0")


def test_season_slug_matches_football_data_folder_naming():
    assert season_slug(2026) == "2627"
    assert season_slug(2099) == "9900"  # century rollover
    assert season_slug(2009) == "0910"


def test_update_saves_validated_csv_under_the_right_url(tmp_path):
    session = FakeSession(FakeResp(GOOD_CSV))
    target = update_current_season(_league(tmp_path), 2026, session)
    assert session.urls == ["https://www.football-data.co.uk/mmz4281/2627/E0.csv"]
    assert target.name == "E0_2627.csv" and target.exists()


def test_junk_download_never_replaces_existing_data(tmp_path):
    league = _league(tmp_path)
    existing = tmp_path / "E0_2627.csv"
    existing.write_bytes(GOOD_CSV)
    with pytest.raises(Exception):
        update_current_season(league, 2026, FakeSession(FakeResp(b"<html>Not Found</html>")))
    assert existing.read_bytes() == GOOD_CSV
    assert not list(tmp_path.glob("*.tmp"))


def test_http_error_is_raised(tmp_path):
    with pytest.raises(Exception):
        update_current_season(_league(tmp_path), 2026, FakeSession(FakeResp(b"", status=404)))


def test_league_without_football_data_code_is_rejected(tmp_path):
    league = League(code="x", name="X", data_folder=str(tmp_path))
    with pytest.raises(ValueError):
        update_current_season(league, 2026, FakeSession(FakeResp(GOOD_CSV)))
