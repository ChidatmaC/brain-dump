import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

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

        const newTask = await prisma.task.create({
            data: {
                title: body.title || null,
                content: body.content,
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

        const { count } = await prisma.task.updateMany({
            where: {
                id: body.id,
                userId,
            },
            data: {
                title: body.title || null,
                content: body.content,
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
