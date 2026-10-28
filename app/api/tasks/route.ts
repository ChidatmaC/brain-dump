import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { categorizeTask, existingCategories } from "@/lib/categorize";

function unauthorized() {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    try{
        const tasks = await prisma.task.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json(tasks);
    } catch (error) {
        console.error("Failed to fetch tasks", error);
        return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    try{
        const body = await request.json();
        const title = body.title || null;

        const category = await categorizeTask(
            { title, content: body.content },
            await existingCategories(userId),
        );

        const newTask = await prisma.task.create({
            data: {
                title,
                content: body.content,
                category,
                userId,
            },
        });  
        return NextResponse.json(newTask);
    } catch (error) {
        console.error("Failed to create task", error);
        return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    try{
        const body = await request.json();

        // Scoping by userId ensures users can only delete their own tasks
        const { count } = await prisma.task.deleteMany({
            where: {
                id: body.id,
                userId,
            }
        });
        if (count === 0) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 });
        }
        return NextResponse.json({ id: body.id });
    } catch (error) {
        console.error("Failed to delete task", error);
        return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    try{
        const body = await request.json();
        const title = body.title || null;

        const existing = await prisma.task.findFirst({ where: { id: body.id, userId } });
        if (!existing) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 });
        }

        // Only re-label when the text actually changed
        const textChanged = existing.title !== title || existing.content !== body.content;
        const category = textChanged
            ? await categorizeTask({ title, content: body.content }, await existingCategories(userId))
            : existing.category;

        const { count } = await prisma.task.updateMany({
            where: {
                id: body.id,
                userId,
            },
            data: {
                title,
                content: body.content,
                category,
            },
        });
        if (count === 0) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 });
        }
        const updatedTask = await prisma.task.findUnique({ where: { id: body.id } });
        return NextResponse.json(updatedTask);
    } catch (error) {
        console.error("Failed to update task", error);
        return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
    }
}
