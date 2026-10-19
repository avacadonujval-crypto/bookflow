import { redirect } from "next/navigation";

/** Upload lives in a modal on the Books page. */
export default function PublisherUploadRedirectPage() {
  redirect("/publisher/books?upload=1");
}
