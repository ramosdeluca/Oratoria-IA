import { supabase } from './supabase';
import { StudentProgress, Lesson } from '../types';
import { getFirstCourse, getCourseModules, getModuleLessons, getLessonExercises } from './courseService';

export const getStudentProgress = async (userId: string): Promise<StudentProgress[]> => {
    const { data, error } = await supabase
        .from('student_progress')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching progress:', error);
        return [];
    }
    return data || [];
};

export const markLessonCompleted = async (userId: string, lessonId: string, score?: number) => {
    // Check if exists
    const { data: existing } = await supabase
        .from('student_progress')
        .select('id')
        .eq('user_id', userId)
        .eq('lesson_id', lessonId)
        .maybeSingle();

    if (existing) {
        const { error } = await supabase
            .from('student_progress')
            .update({ completed: true, score: score, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        return !error;
    } else {
        const { error } = await supabase
            .from('student_progress')
            .insert([{
                user_id: userId,
                lesson_id: lessonId,
                completed: true,
                score: score
            }]);
        return !error;
    }
};

export const getNextLessonForUser = async (userId: string): Promise<{
    course: any,
    module: any,
    lesson: Lesson,
    exercise: any | null
} | null> => {
    // First, see if there's any not completed
    const { data: inProgress } = await supabase
        .from('student_progress')
        .select('lesson_id')
        .eq('user_id', userId)
        .eq('completed', false)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

    let targetLessonId: string | null = null;
    let targetCourse = null;
    let targetModule = null;

    const course = await getFirstCourse();
    if (!course) return null;
    targetCourse = course;

    if (inProgress) {
        targetLessonId = inProgress.lesson_id;
    }

    const modules = await getCourseModules(course.id);
    const progress = await getStudentProgress(userId);
    const completedLessonIds = new Set(progress.filter(p => p.completed).map(p => p.lesson_id));

    if (!targetLessonId) {
        // If no in-progress lesson, find the first lesson of the course that isn't in student_progress
        for (const mod of modules) {
            const lessons = await getModuleLessons(mod.id);
            for (const lesson of lessons) {
                if (!completedLessonIds.has(lesson.id)) {
                    // Encontrou a primeira aula não concluída
                    targetLessonId = lesson.id;
                    targetModule = mod;

                    // Cria um progresso inicial se não existir
                    const hasProgress = progress.find(p => p.lesson_id === lesson.id);
                    if (!hasProgress) {
                        await supabase.from('student_progress').insert([{
                            user_id: userId,
                            lesson_id: lesson.id,
                            completed: false
                        }]);
                    }
                    break;
                }
            }
            if (targetLessonId) break;
        }
    }

    if (!targetLessonId) {
        // Se chegou aqui, terminou o curso inteiro
        return null;
    }

    const { data: lesson } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', targetLessonId)
        .single();

    if (!lesson) return null;

    // Se já tínhamos pego o targetLessonId do inProgress, precisamos achar o module
    if (!targetModule) {
        targetModule = modules.find(m => m.id === lesson.module_id) || null;
    }

    const exercises = await getLessonExercises(lesson.id);

    return {
        course: targetCourse,
        module: targetModule,
        lesson: lesson,
        exercise: exercises.length > 0 ? exercises[0] : null
    };
};
