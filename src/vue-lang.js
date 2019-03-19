export default function (hljs) {
  const XML_IDENT_RE = '[A-Za-z0-9\\._:-]+'
  const TAG_INTERNALS = {
    endsWithParent: true,
    illegal: /</,
    relevance: 0,
    contains: [
      {
        className: 'attr',
        begin: XML_IDENT_RE,
        relevance: 0
      },
      {
        begin: /=\s*/,
        relevance: 0,
        contains: [
          {
            className: 'string',
            endsParent: true,
            variants: [
              { begin: /"/, end: /"/ },
              { begin: /'/, end: /'/ },
              { begin: /[^\s"'=<>`]+/ }
            ]
          }
        ]
      }
    ]
  }
  return {
    case_insensitive: true,
    contains: [
      hljs.COMMENT('<!--', '-->', {
        relevance: 10
      }),
      {
        className: 'tag',
        /*
        The lookahead pattern (?=...) ensures that 'begin' only matches
        '<style' as a single word, followed by a whitespace or an
        ending braket. The '$' is needed for the lexeme to be recognized
        by hljs.subMode() that tests lexemes outside the stream.
        */
        begin: '<style(?=\\s|>|$)',
        end: '>',
        keywords: { name: 'style' },
        contains: [TAG_INTERNALS],
        starts: {
          end: '</style>',
          returnEnd: true,
          subLanguage: ['css', 'less', 'scss', 'stylus']
        }
      },
      {
        className: 'tag',
        // See the comment in the <style tag about the lookahead pattern
        begin: '<script(?=\\s|>|$)',
        end: '>',
        keywords: { name: 'script' },
        contains: [TAG_INTERNALS],
        starts: {
          end: '</script>',
          returnEnd: true,
          subLanguage: ['javascript']
        }
      },
      {
        className: 'tag',
        // See the comment in the <style tag about the lookahead pattern
        begin: '<template(?=\\s|>|$)',
        end: '>',
        keywords: { name: 'template' },
        contains: [TAG_INTERNALS],
        starts: {
          end: '</template>',
          returnEnd: true,
          subLanguage: ['html']
        }
      },
      {
        className: 'tag',
        begin: '</?',
        end: '/?>',
        contains: [
          {
            className: 'name',
            begin: /[^/><\s]+/,
            relevance: 0
          },
          TAG_INTERNALS
        ]
      }
    ]
  }
}
