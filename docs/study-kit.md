# AMANA: Understanding study kit

A small, anonymous study to answer one question: **do people understand a carrier result better after
the AMANA card than after a typical lab letter?** Everything needed to run it is built into the wallet
(`/{ar|en}/study`) and the console dashboard. Nothing here has been run with real participants yet.

## 1. Protocol
| Item | Plan |
|---|---|
| Design | Within-person, before/after. Each person reads the lab letter, answers 3 questions ("before"), then reads the AMANA card for the same result and answers the same 3 questions ("after") |
| Material | Letter: `content/study/letter-{en,ar}.md` (synthetic, HBB carrier). Card: `content/cards/beta-thalassaemia`. Questions: that card's `teachback.yaml` |
| Who | Adults (18+) who can read Arabic or English. Aim for at least 20, with at least 5 in each language and each reading-comfort band you want to report |
| Where | In person, on a phone or laptop running the wallet. About 5 minutes |
| Recorded | Per answer: question number, correct or not, language, self-reported reading comfort (low/mid/high), stage (before/after), a random id made fresh for that quiz. **No name, no device id, no contact details** |
| Not recorded | Anything about the person's own genetic status. Participants read an example result, not their own |
| Stop rule | Anyone can stop at any time; partial answers are kept only as anonymous rows |
| Feedback | "Before" answers get no feedback (so the letter is tested alone). "After" answers show the right answer |

**Known weakness and the fix for a real pilot.** The same questions are asked twice, so some gain is
from practice. For the pilot, add a control arm (letter → letter again) and randomise people 1:1, or
use a parallel group that sees only the card. The comparison of interest is then the difference in
gains between arms.

## 2. Consent (read aloud or shown before starting)
**English.** This is a short study about how clearly genetic results are explained. You will read an
example result that is not about you, and answer 3 questions twice. It takes about 5 minutes. We save
only your answers, your language and how comfortable you feel reading. We do not save your name or
anything that identifies you or your phone. You can stop at any time, and you do not have to give a
reason. Taking part or not will not affect any care you receive.

**العربية.** هذه دراسة قصيرة حول مدى وضوح شرح النتائج الجينية. ستقرأ نتيجة مثالية لا تتعلق بك، وتجيب عن 3 أسئلة
مرتين. يستغرق ذلك نحو 5 دقائق. نحفظ فقط إجاباتك ولغتك ومدى سهولة القراءة بالنسبة لك. لا نحفظ اسمك ولا أي شيء
يدل عليك أو على هاتفك. يمكنك التوقف في أي وقت دون ذكر السبب. مشاركتك أو عدمها لن تؤثر على أي رعاية تتلقاها.

*(Arabic: draft, pending native-speaker review.)*

## 3. Persona cards (for the couple demo, not the study)
Hand these out when people try the couple features. All synthetic.

| Card | Persona | Story | What they will see |
|---|---|---|---|
| A | Mariam + Khalid | Engaged soon, not yet screened as a couple. Want to know privately first | Private check says "you share a change in the same gene"; if both agree, the gene (HBB) |
| B | Noura + Omar | Screened by the programme: compatible. Noura is a carrier | Programme result "compatible"; Noura's own PAH card |
| C | Layla + Yousef | Screened: not compatible (both GJB2) | Programme result routes to a one-to-one counsellor within 48 h |

## 4. Questions (from `content/cards/beta-thalassaemia/teachback.yaml`)
1. If you are a carrier, does that usually mean you are ill? (Yes / **No**)
2. When both parents carry a change in the same gene, what is the chance for each pregnancy that a child has the condition? (**1 in 4** / 1 in 2 / None)
3. Who decides what to do with this information? (**The couple, with support if they want it** / The lab / The family)

Reading comfort is self-reported on the first screen: low, medium, high.

## 5. Analysis plan (fixed before data collection)
- **Primary:** share of correct answers after vs before, all questions pooled. Report the difference in
  percentage points with a 95% confidence interval (paired by quiz id).
- **Per question:** McNemar's test on before/after correctness for each question.
- **Fairness:** the same difference by language and by reading-comfort band. Any group with fewer than
  5 people is **hidden**, never shown as a number (the dashboard does this automatically).
- **Success threshold (pre-stated):** after-score at least 80% overall, and no reported group more than
  10 points below the overall after-score.
- **Never a success measure:** cancelled marriages or any change in marriage decisions.
- Export: the dashboard reads `/api/dashboard` → `understanding.live`. Synthetic rows (the "Add 48
  synthetic people" button) are kept in a separate source and must not be reported.

## 6. Running it
1. Start the demo (README). Open `/{ar|en}/study` on the test device.
2. Give the consent text; the participant ticks "I agree" and starts.
3. After each person, the device is ready for the next; nothing is stored on it.
4. Results appear live on the console dashboard, "Live demo" source.
