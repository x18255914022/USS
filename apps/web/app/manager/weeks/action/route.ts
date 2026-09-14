import { NextResponse } from "next/server";
import { apiFetchServer } from "../../../../lib/serverApi";

function redirect(path: string) {
  return new NextResponse(null, { status: 303, headers: { location: path } });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const semesterId = String(form.get("semesterId") ?? "");
  if (!semesterId) return redirect("/manager/weeks");

  const weekIds = form.getAll("weekId").map((v) => String(v));
  const updates = weekIds.map((id) => {
    const weekType = String(form.get(`weekType_${id}`) ?? "");
    const isActive = form.has(`isActive_${id}`);
    return { id, weekType, isActive };
  });

  await apiFetchServer(`/api/semesters/${encodeURIComponent(semesterId)}/weeks`, {
    method: "PATCH",
    body: JSON.stringify({ updates })
  });

  return redirect(`/manager/weeks?semesterId=${encodeURIComponent(semesterId)}`);
}

