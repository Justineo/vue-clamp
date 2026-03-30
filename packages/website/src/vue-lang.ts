import type { LanguageFn } from "highlight.js";

const vue: LanguageFn = (hljs) => {
  const xmlIdentifier = "[A-Za-z0-9\\._:-]+";
  const tagInternals = {
    contains: [
      {
        begin: xmlIdentifier,
        className: "attr",
        relevance: 0,
      },
      {
        begin: /=\s*/,
        contains: [
          {
            className: "string",
            endsParent: true,
            variants: [
              { begin: /"/, end: /"/ },
              { begin: /'/, end: /'/ },
              { begin: /[^\s"'=<>`]+/ },
            ],
          },
        ],
        relevance: 0,
      },
    ],
    endsWithParent: true,
    illegal: /</,
    relevance: 0,
  };

  return {
    case_insensitive: true,
    contains: [
      hljs.COMMENT("<!--", "-->", { relevance: 10 }),
      {
        begin: "<style(?=\\s|>|$)",
        className: "tag",
        contains: [tagInternals],
        end: ">",
        keywords: { name: "style" },
        starts: {
          end: "</style>",
          returnEnd: true,
          subLanguage: ["css", "less", "scss", "stylus"],
        },
      },
      {
        begin: "<script(?=\\s|>|$)",
        className: "tag",
        contains: [tagInternals],
        end: ">",
        keywords: { name: "script" },
        starts: {
          end: "</script>",
          returnEnd: true,
          subLanguage: ["javascript"],
        },
      },
      {
        begin: "<template(?=\\s|>|$)",
        className: "tag",
        contains: [tagInternals],
        end: ">",
        keywords: { name: "template" },
        starts: {
          end: "</template>",
          returnEnd: true,
          subLanguage: ["html"],
        },
      },
      {
        begin: "</?",
        className: "tag",
        contains: [
          {
            begin: /[^/><\s]+/,
            className: "name",
            relevance: 0,
          },
          tagInternals,
        ],
        end: "/?>",
      },
    ],
  };
};

export default vue;
