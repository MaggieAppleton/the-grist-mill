import React from "react";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

export const markdownPlugins = {
	remarkPlugins: [remarkGfm],
	rehypePlugins: [rehypeSanitize],
};

export const markdownComponents = {
	a: (props) =>
		React.createElement("a", {
			...props,
			target: "_blank",
			rel: "noopener noreferrer",
		}),
	p: (props) => React.createElement("p", props),
};
