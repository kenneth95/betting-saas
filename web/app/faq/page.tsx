import { ContentPage, Section, CTA } from "@/components/ContentPage";
import { faqs } from "@/lib/business";
export default function FAQPage() { return <ContentPage eyebrow="HELP CENTRE" title="Questions, answered." intro="The short version of what the board is, how access works and what we can honestly promise.">{faqs.map(([question, answer]) => <Section key={question} title={question}><p>{answer}</p></Section>)}<CTA href="/contact">Contact support</CTA></ContentPage> }
