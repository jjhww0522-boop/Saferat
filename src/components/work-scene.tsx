// Explanatory drawings only. They never reflect or change a workplace's completion state.
export function WorkScene({ kind = 'observe' }: { kind?: 'observe' | 'talk' | 'record' }) {
  return <svg className="work-scene" viewBox="0 0 360 220" fill="none" aria-hidden="true" focusable="false">
    <rect x="12" y="10" width="336" height="196" rx="28" fill="#eaf1fc"/>
    <path d="M32 167L143 116L331 159L220 211Z" fill="#d7e5f7"/>
    <path d="M41 164L148 117M96 188L200 139M167 205L269 158" stroke="#b2c9e7" strokeWidth="2"/>
    <rect x="45" y="39" width="100" height="75" rx="8" fill="white" stroke="#b2c9e7" strokeWidth="2"/>
    <path d="M65 61H123M65 75H104M65 89H115" stroke="#a1b8d5" strokeWidth="5" strokeLinecap="round"/>
    <path d="M72 153L69 183M89 153L101 175" stroke="#29466f" strokeWidth="10" strokeLinecap="round"/>
    <path d="M77 106L79 151M77 118L54 138M82 119L108 132" stroke="#3064ce" strokeWidth="13" strokeLinecap="round"/>
    <circle cx="78" cy="88" r="15" fill="#f2c6a0"/>
    <path d="M60 84C60 60 97 60 97 84Z" fill="#e9ae39"/>
    <path d="M58 85H100" stroke="#92640b" strokeWidth="3" strokeLinecap="round"/>
    {kind === 'observe' ? <>
      <path d="M158 127L201 110L242 127L200 146Z" fill="#edc487" stroke="#9c6c2a" strokeWidth="2"/>
      <path d="M158 127V163L200 182V146Z" fill="#dba85f" stroke="#9c6c2a" strokeWidth="2"/>
      <path d="M200 146L242 127V164L200 182Z" fill="#f4d5a4" stroke="#9c6c2a" strokeWidth="2"/>
      <path d="M178 119L221 137V154" stroke="#fff1d8" strokeWidth="7"/>
      <ellipse cx="202" cy="157" rx="72" ry="43" stroke="#b66e10" strokeWidth="2" strokeDasharray="5 6"/>
      <circle cx="283" cy="72" r="30" fill="white" stroke="#285dcc" strokeWidth="3"/>
      <path d="M305 96L322 113" stroke="#285dcc" strokeWidth="8" strokeLinecap="round"/>
      <path d="M283 58V75M283 84V85" stroke="#285dcc" strokeWidth="5" strokeLinecap="round"/>
    </> : kind === 'talk' ? <>
      <path d="M234 150L225 183M250 150L262 178" stroke="#29466f" strokeWidth="10" strokeLinecap="round"/>
      <path d="M242 106V151M239 120L213 134M246 120L263 139" stroke="#597e6d" strokeWidth="13" strokeLinecap="round"/>
      <circle cx="241" cy="87" r="15" fill="#f2c6a0"/>
      <path d="M224 83C224 63 258 61 259 84Z" fill="#29466f"/>
      <path d="M149 38H207C217 38 223 44 223 53V73C223 82 217 88 207 88H173L154 103V88H149C139 88 134 82 134 73V53C134 44 139 38 149 38Z" fill="white" stroke="#789bc7" strokeWidth="2"/>
      <circle cx="160" cy="64" r="4" fill="#285dcc"/><circle cx="179" cy="64" r="4" fill="#285dcc"/><circle cx="198" cy="64" r="4" fill="#285dcc"/>
    </> : <>
      <rect x="174" y="38" width="134" height="156" rx="12" fill="white" stroke="#789bc7" strokeWidth="2"/>
      <rect x="209" y="28" width="64" height="22" rx="7" fill="#3064ce"/>
      <path d="M195 75H281M195 91H255M222 125H281M222 150H265M222 175H273" stroke="#a1b8d5" strokeWidth="5" strokeLinecap="round"/>
      <rect x="193" y="116" width="15" height="15" rx="3" stroke="#537ab0" strokeWidth="2"/>
      <rect x="193" y="142" width="15" height="15" rx="3" stroke="#537ab0" strokeWidth="2"/>
      <rect x="193" y="168" width="15" height="15" rx="3" stroke="#537ab0" strokeWidth="2"/>
      <path d="M303 133L326 85L336 90L313 138L301 147Z" fill="#e9ae39" stroke="#92640b" strokeWidth="2"/>
    </>}
  </svg>;
}
