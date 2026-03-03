import { supabase } from './supabase';
import { Course, CourseModule, Lesson, Exercise } from '../types';

export const getFirstCourse = async (): Promise<Course | null> => {
    const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('Error fetching course:', error);
        return null;
    }
    return data;
};

export const getCourseModules = async (courseId: string): Promise<CourseModule[]> => {
    const { data, error } = await supabase
        .from('course_modules')
        .select('*')
        .eq('course_id', courseId)
        .order('position', { ascending: true });

    if (error) {
        console.error('Error fetching modules:', error);
        return [];
    }
    return data || [];
};

export const getModuleLessons = async (moduleId: string): Promise<Lesson[]> => {
    const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('module_id', moduleId)
        .order('position', { ascending: true });

    if (error) {
        console.error('Error fetching lessons:', error);
        return [];
    }
    return data || [];
};

export const getLessonExercises = async (lessonId: string): Promise<Exercise[]> => {
    const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('lesson_id', lessonId);

    if (error) {
        console.error('Error fetching exercises:', error);
        return [];
    }
    return data || [];
};

export const getLessonById = async (lessonId: string): Promise<Lesson | null> => {
    const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .single();

    if (error) return null;
    return data;
};
