import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try{
        const tasks = await prisma.task.findMany();
        return NextResponse.json(tasks);
    } catch (error) {
        console.error("Failed to fetch tasks", error);
        return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try{
        const body = await request.json();

        const newTask = await prisma.task.create({
            data: {
                title: body.title || null,
                content: body.content,
            },
        });  
        return NextResponse.json(newTask);
    } catch (error) {
        console.error("Failed to create task", error);
        return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try{
        const body = await request.json();

        const deletedTask = await prisma.task.delete({
            where: {
                id: body.id,
            }
        });
        return NextResponse.json(deletedTask);
    } catch (error) {
        console.error("Failed to delete task", error);
        return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try{
        const body = await request.json();

        const updatedTask = await prisma.task.update({
            where: {
                id: body.id,
            },
            data: {
                title: body.title || null,
                content: body.content,
            },
        });
        return NextResponse.json(updatedTask);
    } catch (error) {
        console.error("Failed to update task", error);
        return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
    }
}
