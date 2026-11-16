# 「축구」 웹앱 (아이 + 관리자)

빌드 없이 그대로 올리는 정적 웹앱이다. 파일을 아무 정적 호스팅(Vercel 등)에 올리면 된다.
Supabase에는 마이그레이션 01~06이 실행돼 있어야 한다 (06 = v6 관리자 버전).

## 1. Supabase 설정 (한 번)

1. SQL Editor에서 `20261116000006_v6_solo_admin.sql` 실행 (아직 안 했다면)
2. Authentication → Sign In / Providers → Email → **Confirm email 끄기**
   - 아이들은 메일 확인을 못 할 수 있어서. 끄면 가입하자마자 로그인된다
   - 아이 메일이 없으면 `gongchagi@chukgu.app`처럼 관리자가 정한 주소를 써도 된다(메일이 실제로 가지 않아도 됨)
3. Project Settings → API에서 **Project URL**과 **anon public key** 복사

## 2. 연결 정보 넣기 (둘 중 하나)

- 권장: `js/config.js`의 `SUPABASE_URL`, `SUPABASE_ANON_KEY` 두 줄을 채운다 → 모든 기기에서 바로 연결
- 비워 두면: 처음 열 때 「처음 설정」 화면에서 기기마다 입력

anon key는 공개돼도 괜찮은 키다. service_role 키는 절대 넣지 말 것.

## 3. 올리기 (Vercel)

1. GitHub에 새 저장소를 만들고 이 폴더 파일을 전부 올린다 (웹에서 Add file → Upload files로 드래그해도 됨)
2. Vercel → Add New → Project → 그 저장소 Import → Framework Preset **Other**, Build Command 비움 → Deploy
3. 나온 주소를 폰에서 열고 「홈 화면에 추가」 하면 앱처럼 쓸 수 있다

## 4. 처음 쓰는 순서

1. 관리자(나): 회원가입 → 닉네임·태어난 해 입력, **초대 코드는 비워 두고** 가입 신청
2. SQL Editor: `select public.make_admin('내닉네임');` → 앱에서 「다시 확인」 → 내 훈련 홈이 열리고, 하단 「관리」 탭에 초대 코드가 보인다
3. 아이: 회원가입 → 닉네임·태어난 해·**초대 코드** → 승인 대기
4. 관리자 홈에서 아이를 눌러 승인 → 아이가 「다시 확인」 → 배치 테스트부터 시작
5. 14세 미만 보호자 동의는 앱 밖에서 받는다

## 들어 있는 기능

관리자도 같은 계정으로 훈련한다. 관리자 계정에는 하단에 **「관리」 탭**이 하나 더 생기고, 거기서 아래 관리 기능을 쓴다.

| 아이 (관리자도 같음) | 관리자 「관리」 탭 |
|---|---|
| 배치 테스트 8종목·재측정, 유닛 1~6·8 레슨(워밍업 3분·미션 기록·스트레칭 2분), 승급 체크·보물상자, 전술 연습 세트·승급 시험, 일일 퀘스트, 프로필(점수), 관리자 코멘트 보기, 상점, 에너지 부족 안내 | 아이 목록(오늘 훈련·코멘트 할 레슨·승인 대기), 가입 승인/거절, 레슨 기록 보고 코멘트, 점수·유닛 진행 보기, 수비 스테이지 3·4 1대1 결과 입력, 초대 코드 공유 |

## 파일

```
index.html  style.css  manifest.webmanifest  icon.svg
js/config.js   Supabase 연결 정보
js/api.js      Supabase 인증·REST 호출 (라이브러리 없음)
js/app.js      시작·라우터·로그인/가입/승인 대기
js/player.js   아이 화면
js/admin.js    관리자 화면
js/ui.js       공통 도우미
```

알려진 한계: 승급 영상 올리기, 전술 문제 그림, 닉네임 변경, 관리자 알림은 아직 없다.
