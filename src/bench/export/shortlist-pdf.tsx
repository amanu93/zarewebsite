import { Document, Page, pdf, StyleSheet, Text, View } from '@react-pdf/renderer';

import type { ExportCandidate, ExportDocument } from './shortlist';

/**
 * The shortlist PDF. Accepts an ExportDocument and nothing else — see
 * shortlist.ts for why that type is the privacy boundary.
 *
 * Printed on white: this leaves the building, gets forwarded and printed,
 * and a dark page does neither well. Built-in Helvetica and Courier only, so
 * generation needs no network and works offline in the browser.
 *
 * Loaded with a dynamic import from the builder, so @react-pdf stays out of
 * every other page's bundle.
 */

const INK = '#0b0f14';
const DIM = '#4b5563';
const FAINT = '#9aa3ae';
const LINE = '#e5e7eb';
const ACCENT = '#0a8f91';
const TINT = '#effafa';

const s = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 64,
    paddingHorizontal: 52,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: INK,
    lineHeight: 1.45,
  },
  brand: { fontFamily: 'Helvetica-Bold', fontSize: 9, letterSpacing: 2, color: INK },
  eyebrow: { fontSize: 7.5, letterSpacing: 1.6, color: FAINT, fontFamily: 'Helvetica-Bold' },
  rule: { height: 1, backgroundColor: LINE, marginVertical: 18 },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 52,
    right: 52,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    color: FAINT,
  },

  // cover
  coverTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  coverBody: { marginTop: 150 },
  coverTitle: { fontFamily: 'Helvetica-Bold', fontSize: 30, lineHeight: 1.15, marginTop: 10 },
  coverClient: { fontSize: 15, color: DIM, marginTop: 8 },
  coverStats: { flexDirection: 'row', marginTop: 40 },
  coverStat: { marginRight: 44 },
  coverStatValue: { fontFamily: 'Helvetica-Bold', fontSize: 20, marginTop: 4 },
  coverNote: {
    marginTop: 56,
    padding: 14,
    backgroundColor: TINT,
    borderLeftWidth: 2,
    borderLeftColor: ACCENT,
    fontSize: 9.5,
    color: DIM,
  },

  // candidate
  candHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  // Courier's metrics confuse the inherited line height, so the block is
  // sized explicitly or the role line renders on top of the ref code.
  ref: { fontFamily: 'Courier-Bold', fontSize: 26, letterSpacing: 1, lineHeight: 1, height: 28 },
  role: { fontSize: 10.5, color: DIM, marginTop: 6 },
  position: { fontSize: 8, color: FAINT, letterSpacing: 1.2 },
  overall: {
    alignItems: 'flex-end',
  },
  overallValue: { fontFamily: 'Helvetica-Bold', fontSize: 16, color: ACCENT, marginTop: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  cell: { width: '33.33%', marginBottom: 14, paddingRight: 10 },
  cellValue: { fontSize: 11, marginTop: 3 },
  section: { marginTop: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  chip: {
    fontSize: 9,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 3,
    paddingVertical: 2.5,
    paddingHorizontal: 6,
    marginRight: 5,
    marginBottom: 5,
    color: DIM,
  },
  bulletRow: { flexDirection: 'row', marginTop: 6 },
  bullet: { width: 4, height: 4, borderRadius: 2, marginTop: 5, marginRight: 8 },
  bulletText: { flex: 1, fontSize: 10.5 },
  twoCol: { flexDirection: 'row' },
  col: { flex: 1, paddingRight: 16 },

  // closing
  closingTitle: { fontFamily: 'Helvetica-Bold', fontSize: 22, marginTop: 120 },
  step: { flexDirection: 'row', marginTop: 16 },
  stepNum: { fontFamily: 'Courier-Bold', fontSize: 11, color: ACCENT, width: 26 },
  stepText: { flex: 1, fontSize: 11, color: DIM },
  contact: { marginTop: 48, paddingTop: 16, borderTopWidth: 1, borderTopColor: LINE },
});

function Footer({ doc }: { doc: ExportDocument }) {
  return (
    <View style={s.footer} fixed>
      <Text>Zare Innovations · Confidential · Prepared for {doc.client_name}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={s.cell}>
      <Text style={s.eyebrow}>{label}</Text>
      <Text style={s.cellValue}>{value ?? '—'}</Text>
    </View>
  );
}

function CandidatePage({
  c,
  index,
  doc,
}: {
  c: ExportCandidate;
  index: number;
  doc: ExportDocument;
}) {
  const availability = [
    `Confirmed ${c.availability.confirmed_on}`,
    c.availability.earliest_start ? `Can start ${c.availability.earliest_start}` : null,
    c.availability.notice_period ? `Notice: ${c.availability.notice_period}` : null,
  ].filter(Boolean) as string[];

  const setup = [
    c.work_setup.setup_verified ? 'Home setup verified' : 'Home setup not yet verified',
    c.work_setup.shifts.length ? `Shifts: ${c.work_setup.shifts.join(', ')}` : null,
  ].filter(Boolean) as string[];

  return (
    <Page size="A4" style={s.page}>
      <View style={s.coverTop}>
        <Text style={s.brand}>ZARE</Text>
        <Text style={s.position}>
          CANDIDATE {index + 1} OF {doc.candidates.length}
        </Text>
      </View>
      <View style={s.rule} />

      <View style={s.candHead}>
        <View>
          <Text style={s.ref}>{c.ref_code}</Text>
          <Text style={s.role}>{doc.role_name}</Text>
        </View>
        <View style={s.overall}>
          <Text style={s.eyebrow}>ASSESSMENT</Text>
          <Text style={s.overallValue}>{c.assessment.overall}</Text>
        </View>
      </View>
      <View style={s.rule} />

      <View style={s.grid}>
        <Field label="EXPERIENCE" value={c.experience} />
        <Field label="SENIORITY" value={c.seniority} />
        <Field label="ENGLISH" value={c.english} />
        <Field label="COMMUNICATION" value={c.assessment.communication} />
        {c.assessment.technical && <Field label="TECHNICAL" value={c.assessment.technical} />}
      </View>

      {c.stack.length > 0 && (
        <View style={s.section}>
          <Text style={s.eyebrow}>STACK</Text>
          <View style={s.chips}>
            {c.stack.map((t) => (
              <Text key={t} style={s.chip}>
                {t}
              </Text>
            ))}
          </View>
        </View>
      )}

      <View style={[s.section, s.twoCol]}>
        <View style={s.col}>
          <Text style={s.eyebrow}>AVAILABILITY</Text>
          {availability.map((line) => (
            <Text key={line} style={[s.cellValue, { fontSize: 10.5 }]}>
              {line}
            </Text>
          ))}
        </View>
        <View style={s.col}>
          <Text style={s.eyebrow}>WORK SETUP</Text>
          {setup.map((line) => (
            <Text key={line} style={[s.cellValue, { fontSize: 10.5 }]}>
              {line}
            </Text>
          ))}
        </View>
      </View>

      <View style={s.rule} />

      <View>
        <Text style={s.eyebrow}>STRENGTHS</Text>
        {c.strengths.map((t) => (
          <View key={t} style={s.bulletRow}>
            <View style={[s.bullet, { backgroundColor: ACCENT }]} />
            <Text style={s.bulletText}>{t}</Text>
          </View>
        ))}
      </View>

      <View style={s.section}>
        <Text style={s.eyebrow}>CONSIDERATION</Text>
        <View style={s.bulletRow}>
          <View style={[s.bullet, { backgroundColor: FAINT }]} />
          <Text style={s.bulletText}>{c.consideration}</Text>
        </View>
      </View>

      <Footer doc={doc} />
    </Page>
  );
}

export function ShortlistDocument({ doc }: { doc: ExportDocument }) {
  const first = doc.candidates[0]?.ref_code;
  return (
    <Document
      title={`Shortlist for ${doc.client_name}`}
      author="Zare Innovations"
      creator="Zare Bench"
      producer="Zare Bench"
    >
      {/* ---- cover ---- */}
      <Page size="A4" style={s.page}>
        <View style={s.coverTop}>
          <Text style={s.brand}>ZARE INNOVATIONS</Text>
          <Text style={s.position}>{doc.prepared_on.toUpperCase()}</Text>
        </View>

        <View style={s.coverBody}>
          <Text style={s.eyebrow}>CANDIDATE SHORTLIST</Text>
          <Text style={s.coverTitle}>{doc.role_name}</Text>
          <Text style={s.coverClient}>Prepared for {doc.client_name}</Text>

          <View style={s.coverStats}>
            <View style={s.coverStat}>
              <Text style={s.eyebrow}>CANDIDATES</Text>
              <Text style={s.coverStatValue}>{doc.candidates.length}</Text>
            </View>
            <View style={s.coverStat}>
              <Text style={s.eyebrow}>REQUESTED</Text>
              <Text style={s.coverStatValue}>{doc.quantity}</Text>
            </View>
            <View style={s.coverStat}>
              <Text style={s.eyebrow}>AVAILABILITY CHECKED WITHIN</Text>
              <Text style={s.coverStatValue}>{doc.freshness_days} days</Text>
            </View>
          </View>

          <View style={s.coverNote}>
            {doc.unconfirmed === 0 ? (
              <Text>
                Every candidate in this document has been assessed by Zare and has confirmed their
                availability by phone within the last {doc.freshness_days} days. Candidates are
                identified by reference code only.
              </Text>
            ) : (
              <Text>
                DRAFT, NOT FOR SENDING. {doc.unconfirmed} of {doc.candidates.length} candidates still need
                their availability confirmed. Candidates are identified by reference code only.
              </Text>
            )}
          </View>
        </View>

        <Footer doc={doc} />
      </Page>

      {doc.candidates.map((c, i) => (
        <CandidatePage key={c.ref_code} c={c} index={i} doc={doc} />
      ))}

      {/* ---- closing ---- */}
      <Page size="A4" style={s.page}>
        <View style={s.coverTop}>
          <Text style={s.brand}>ZARE INNOVATIONS</Text>
        </View>

        <Text style={s.closingTitle}>Next steps</Text>

        <View style={s.step}>
          <Text style={s.stepNum}>01</Text>
          <Text style={s.stepText}>
            Reply with the reference codes you would like to meet{first ? `, for example ${first}` : ''}.
          </Text>
        </View>
        <View style={s.step}>
          <Text style={s.stepNum}>02</Text>
          <Text style={s.stepText}>
            We reconfirm availability and arrange interviews, usually within 48 hours.
          </Text>
        </View>
        <View style={s.step}>
          <Text style={s.stepNum}>03</Text>
          <Text style={s.stepText}>
            Full profiles and CVs are shared for the candidates you select.
          </Text>
        </View>

        <View style={s.contact}>
          <Text style={s.eyebrow}>YOUR CONTACT</Text>
          <Text style={[s.cellValue, { fontFamily: 'Helvetica-Bold' }]}>{doc.prepared_by.name}</Text>
          <Text style={{ fontSize: 10.5, color: DIM }}>{doc.prepared_by.email}</Text>
        </View>

        <Footer doc={doc} />
      </Page>
    </Document>
  );
}

export async function renderShortlistPdf(doc: ExportDocument): Promise<Blob> {
  return pdf(<ShortlistDocument doc={doc} />).toBlob();
}
