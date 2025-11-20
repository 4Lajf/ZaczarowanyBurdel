import type { ImageRecord, Category, TagCollection, TagStats } from './types';

export type Metric = 'interactions' | 'posts' | 'popularity' | 'reactions';

export interface TopTagsParams {
  data: ImageRecord[];
  category?: Category;
  categories?: Category[]; // Allow multiple categories
  limit?: number;
  minSupport?: number;
  metric?: Metric;
  allowedGeneralTags?: Set<string> | string[]; // If provided, only these tags are allowed for 'general' category
}

export function getTopTags({
  data,
  category,
  categories,
  limit = 50,
  minSupport = 1,
  metric = 'interactions',
  allowedGeneralTags
}: TopTagsParams): TagStats[] {
  const counts = new Map<string, { count: number; category: Category }>();

  // Determine allowed categories
  const allowedCats = new Set<Category>();
  if (category) allowedCats.add(category);
  else if (categories) categories.forEach(c => allowedCats.add(c));
  else ['character', 'copyright', 'artist', 'general'].forEach(c => allowedCats.add(c as Category));

  // Convert allowedGeneralTags to Set for faster lookup if it's an array
  const generalWhitelist = allowedGeneralTags 
    ? (Array.isArray(allowedGeneralTags) ? new Set(allowedGeneralTags) : allowedGeneralTags) 
    : null;

  for (const record of data) {
    let weight: number;
    
    if (metric === 'posts') {
      weight = 1; // Count each image once
    } else if (metric === 'reactions') {
        weight = 1;
        // Exclude author posts. 
        // A record counts only if at least one reactor exists (and we are counting reactions).
        // But here we are counting TAGS. So if there are reactors, does the tag get count = num_reactors?
        // "Reactions given" usually implies from a user perspective.
        // For global top tags, "Reactions" metric probably means "Tags that appear in posts that received reactions" OR "Tags that people reacted to".
        // In 'interactions' mode, weight = reactors.length (+1 if author distinct).
        // So in 'reactions' mode, weight should probably be reactors.length.
        // And we exclude author contribution?
        // If I react to a post, I contribute 1 to the tag's weight.
        // So weight = record.reactors.length.
        // Wait, the user said "only reactions that given user gave". This is user-centric.
        // For GLOBAL top tags, it should sum up all reactions given by all users?
        // If so, weight = record.reactors.length.
        weight = record.reactors.length;
    } else {
      // interactions: count reactions + authorship
      const users = [...record.reactors];
      if (record.author && !users.includes(record.author)) {
        users.push(record.author); 
      }
      weight = users.length;
    }
    
    allowedCats.forEach(cat => {
        record.tags[cat]?.forEach(tag => {
            // Filter generic tags if whitelist is provided and category is general
            if (cat === 'general' && generalWhitelist && !generalWhitelist.has(tag)) {
                return;
            }

            const current = counts.get(tag) || { count: 0, category: cat };
            counts.set(tag, { count: current.count + weight, category: cat });
        });
    });
  }

  const result: TagStats[] = [];
  for (const [tag, { count, category: cat }] of counts.entries()) {
    if (count >= minSupport) {
      result.push({ tag, count, category: cat });
    }
  }

  result.sort((a, b) => b.count - a.count);
  return result.slice(0, limit);
}

export interface TopUserTagsParams {
  data: ImageRecord[];
  userId: string;
  category?: Category;
  limit?: number;
  metric?: Metric;
  allowedGeneralTags?: Set<string> | string[];
}

export function getTopUserTags({
  data,
  userId,
  category,
  limit = 20,
  metric = 'interactions',
  allowedGeneralTags
}: TopUserTagsParams): TagStats[] {
  const counts = new Map<string, { count: number; category: Category }>();
  
  const generalWhitelist = allowedGeneralTags 
    ? (Array.isArray(allowedGeneralTags) ? new Set(allowedGeneralTags) : allowedGeneralTags) 
    : null;

  for (const record of data) {
    const isReactor = record.reactors.includes(userId);
    const isAuthor = record.author === userId;
    
    if (metric === 'popularity') {
      // Popularity: count reactions on posts authored by this user
      if (!isAuthor) continue;
      // Weight = number of reactions on this post
      const weight = record.reactors.length;
      
      ['character', 'copyright', 'artist', 'general'].forEach(cat => {
        const catKey = cat as Category;
        if (category && category !== catKey) return;

        record.tags[catKey]?.forEach(tag => {
            if (catKey === 'general' && generalWhitelist && !generalWhitelist.has(tag)) return;

          const current = counts.get(tag) || { count: 0, category: catKey };
          counts.set(tag, { count: current.count + weight, category: catKey });
        });
      });
    } else if (metric === 'reactions') {
      // Count reactions only
      if (isAuthor) continue; // Explicitly exclude author posts
      // Actually check if user is in reactors list
      if (!record.reactors.includes(userId)) continue;
      
      const weight = 1; // Count each reaction
      
      ['character', 'copyright', 'artist', 'general'].forEach(cat => {
        const catKey = cat as Category;
        if (category && category !== catKey) return;

        record.tags[catKey]?.forEach(tag => {
          if (catKey === 'general' && generalWhitelist && !generalWhitelist.has(tag)) return;

          const current = counts.get(tag) || { count: 0, category: catKey };
          counts.set(tag, { count: current.count + weight, category: catKey });
        });
      });
    } else {
      // interactions or posts
      if (!isReactor && !isAuthor) continue;

      if (metric === 'posts') {
        if (!isAuthor) continue;
      }
      
      // Weight is 1 per image for interactions/posts modes
      ['character', 'copyright', 'artist', 'general'].forEach(cat => {
        const catKey = cat as Category;
        if (category && category !== catKey) return;

        record.tags[catKey]?.forEach(tag => {
          if (catKey === 'general' && generalWhitelist && !generalWhitelist.has(tag)) return;

          const current = counts.get(tag) || { count: 0, category: catKey };
          counts.set(tag, { count: current.count + 1, category: catKey });
        });
      });
    }
  }

  const result: TagStats[] = [];
  for (const [tag, { count, category: cat }] of counts.entries()) {
    result.push({ tag, count, category: cat });
  }
  
  result.sort((a, b) => b.count - a.count);
  return result.slice(0, limit);
}

export interface TopUsersParams {
  data: ImageRecord[];
  limit?: number;
  metric?: Metric;
}

export function getTopUsers({ data, limit = 50, metric = 'interactions' }: TopUsersParams): { userId: string, count: number }[] {
    const counts = new Map<string, number>();
    
    for (const r of data) {
        if (metric === 'posts') {
            // Count only authors
            if (r.author) {
                counts.set(r.author, (counts.get(r.author) || 0) + 1);
            }
        } else if (metric === 'reactions') {
            // Count reactions given by each user
            // If user is in reactors, count +1
            r.reactors.forEach(u => counts.set(u, (counts.get(u) || 0) + 1));
        } else {
            // Count interactions (reactors + author)
            r.reactors.forEach(u => counts.set(u, (counts.get(u) || 0) + 1));
            if (r.author && !r.reactors.includes(r.author)) {
                 counts.set(r.author, (counts.get(r.author) || 0) + 1);
            }
        }
    }
    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([userId, count]) => ({ userId, count }));
}

export interface TagNeighborParams {
  data: ImageRecord[];
  targetTag: string;
  targetCategory?: Category; // Category of the target tag, to help find it
  limit?: number;
  minCooccurrence?: number;
  metric?: Metric;
  allowedGeneralTags?: Set<string> | string[];
  allowedCategories?: (Category | 'user')[]; // Use this to control if we look for user neighbors
}

interface Link {
    source: string;
    target: string;
    value: number;
}

interface Node {
    id: string;
    name: string;
    category: number | Category | 'user'; // category index or name or 'user'
    value: number; // occurrence
}


export function getGlobalNetwork({ 
    data, 
    limit = 30, 
    minCooccurrence = 2,
    allowedCategories,
    metric = 'interactions',
    allowedGeneralTags
}: { 
    data: ImageRecord[], 
    limit?: number, 
    minCooccurrence?: number,
    allowedCategories?: (Category | 'user')[],
    metric?: Metric,
    allowedGeneralTags?: Set<string> | string[]
}) {
    const includeUsers = allowedCategories?.includes('user') ?? false;
    const tagCategories = allowedCategories 
        ? allowedCategories.filter(c => c !== 'user') as Category[]
        : undefined;

    // 1. Get top tags globally (filtered by allowedCategories if provided)
    const topTags = getTopTags({ 
        data, 
        limit: limit, 
        categories: tagCategories, 
        metric,
        allowedGeneralTags 
    }); 
    const topTagSet = new Set(topTags.map(t => t.tag));
    
    // 1.5 Get top users if enabled
    // We limit users to roughly half the node limit to avoid overcrowding if mixed
    const topUsers = includeUsers ? getTopUsers({ data, limit: Math.max(10, Math.floor(limit / 2)), metric }) : [];
    const topUserSet = new Set(topUsers.map(u => u.userId));

    const generalWhitelist = allowedGeneralTags 
        ? (Array.isArray(allowedGeneralTags) ? new Set(allowedGeneralTags) : allowedGeneralTags) 
        : null;

    // 2. Calculate edges between them
    const edges = new Map<string, number>();
    
    for (const record of data) {
        const tagsInRecord = new Set<string>();
        const catsToCheck = tagCategories || ['character', 'copyright', 'artist', 'general'];
        
        catsToCheck.forEach(cat => {
             record.tags[cat as Category]?.forEach(t => {
                 // Check whitelist for general tags
                 if (cat === 'general' && generalWhitelist && !generalWhitelist.has(t)) return;
                 
                 if (topTagSet.has(t)) tagsInRecord.add(t);
             });
        });

        const tags = Array.from(tagsInRecord);

        // Identify active users in this record who are in topUserSet
        const activeUsersInRecord: string[] = [];
        if (includeUsers) {
             const users = [];
             if (metric === 'posts') {
                if (record.author) users.push(record.author);
             } else if (metric === 'reactions') {
                 // Only reactors are active users
                 record.reactors.forEach(u => users.push(u));
             } else {
                 // interactions
                 if (record.author) users.push(record.author);
                 record.reactors.forEach(u => users.push(u));
             }
             
             users.forEach(u => {
                 if (topUserSet.has(u)) activeUsersInRecord.push(u);
             });
        }

        if (tags.length < 1 && activeUsersInRecord.length < 1) continue;

        // Weight calculation for tag-tag edges
        let weight: number;
        if (metric === 'posts') {
          weight = 1;
        } else if (metric === 'reactions') {
            weight = record.reactors.length;
        } else {
          const users = [...record.reactors];
          if (record.author && !users.includes(record.author)) {
            users.push(record.author); 
          }
          weight = users.length;
        }
        
        // Tag-Tag Edges
        for (let i = 0; i < tags.length; i++) {
            for (let j = i + 1; j < tags.length; j++) {
                const t1 = tags[i];
                const t2 = tags[j];
                const key = t1 < t2 ? `${t1}|${t2}` : `${t2}|${t1}`;
                edges.set(key, (edges.get(key) || 0) + weight);
            }
        }

        // User-Tag Edges
        if (activeUsersInRecord.length > 0 && tags.length > 0) {
             let userTagWeight = 1;
             if (metric === 'popularity') {
                 userTagWeight = record.reactors.length;
             }

             for (const user of activeUsersInRecord) {
                 for (const tag of tags) {
                      const key = user < tag ? `${user}|${tag}` : `${tag}|${user}`;
                      edges.set(key, (edges.get(key) || 0) + userTagWeight);
                 }
             }
        }

        // User-User Edges (Co-reactors)
        // Only relevant if multiple users interact with same image
        if (activeUsersInRecord.length > 1) {
            // Co-reaction weight
            // If it's 'interactions', they both interacted with 1 image -> weight 1
            // If it's 'posts', author is usually unique, so length is 1 (unless multi-author supported?)
            // If it's 'popularity', author is unique.
            // So this mainly applies to 'interactions' metric where multiple reactors exist.
            
            const userUserWeight = 1; // 1 co-interaction
            
            for (let i = 0; i < activeUsersInRecord.length; i++) {
                for (let j = i + 1; j < activeUsersInRecord.length; j++) {
                    const u1 = activeUsersInRecord[i];
                    const u2 = activeUsersInRecord[j];
                    const key = u1 < u2 ? `${u1}|${u2}` : `${u2}|${u1}`;
                    edges.set(key, (edges.get(key) || 0) + userUserWeight);
                }
            }
        }
    }

    const nodes: Node[] = [
        ...topTags.map(t => ({
            id: t.tag,
            name: t.tag,
            category: t.category,
            value: t.count
        })),
        ...topUsers.map(u => ({
            id: u.userId,
            name: u.userId,
            category: 'user' as const,
            value: u.count
        }))
    ];
    
    const links: Link[] = [];
    for (const [key, weight] of edges.entries()) {
        if (weight < minCooccurrence) continue;
        const [source, target] = key.split('|');
        links.push({ source, target, value: weight });
    }

    return { nodes, links };
}


export function getTagNeighbors({
  data,
  targetTag,
  limit = 20,
  minCooccurrence = 1,
  metric = 'interactions',
  allowedGeneralTags,
  allowedCategories
}: TagNeighborParams): { nodes: Node[], links: Link[] } {
    
  const coOccurrences = new Map<string, { count: number, category: Category | 'user' }>();
  let targetTagCount = 0;
  let targetTagCategory: Category = 'general';

  const includeUsers = allowedCategories?.includes('user') ?? false;
  const generalWhitelist = allowedGeneralTags 
        ? (Array.isArray(allowedGeneralTags) ? new Set(allowedGeneralTags) : allowedGeneralTags) 
        : null;

  for (const record of data) {
      // Check if image has targetTag
      let hasTarget = false;
      
      // Flatten tags
      const allTags: {tag: string, cat: Category}[] = [];
      ['character', 'copyright', 'artist', 'general'].forEach(cat => {
        const catKey = cat as Category;
        record.tags[catKey]?.forEach(t => {
            // Check whitelist for general tags
            if (catKey === 'general' && generalWhitelist && !generalWhitelist.has(t) && t !== targetTag) return;

            allTags.push({ tag: t, cat: catKey });
            if (t === targetTag) {
                hasTarget = true;
                targetTagCategory = catKey;
            }
        });
      });

      if (!hasTarget) continue;

      let weight: number;
      if (metric === 'posts') {
        weight = 1;
      } else if (metric === 'reactions') {
        weight = record.reactors.length;
      } else {
        const users = [...record.reactors];
        if (record.author && !users.includes(record.author)) {
          users.push(record.author); 
        }
        weight = users.length;
      }
      
      targetTagCount += weight;

      // 1. Tag-Tag Neighbors
      for (const t of allTags) {
          if (t.tag === targetTag) continue;
          const current = coOccurrences.get(t.tag) || { count: 0, category: t.cat };
          coOccurrences.set(t.tag, { count: current.count + weight, category: t.cat });
      }

      // 2. User Neighbors (User-Tag)
      if (includeUsers) {
             const activeUsersInRecord: string[] = [];
             if (metric === 'posts') {
                if (record.author) activeUsersInRecord.push(record.author);
             } else if (metric === 'reactions') {
                 record.reactors.forEach(u => activeUsersInRecord.push(u));
             } else {
                 // interactions
                 if (record.author) activeUsersInRecord.push(record.author);
                 record.reactors.forEach(u => activeUsersInRecord.push(u));
             }
             
             let userWeight = 1;
             if (metric === 'popularity') userWeight = record.reactors.length;

             const uniqueUsers = new Set(activeUsersInRecord);
             
             uniqueUsers.forEach(u => {
                 const current = coOccurrences.get(u) || { count: 0, category: 'user' };
                 coOccurrences.set(u, { count: current.count + userWeight, category: 'user' });
             });
      }
  }

  // Sort by count
  const sortedNeighbors = Array.from(coOccurrences.entries())
    .filter(([_, val]) => val.count >= minCooccurrence)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit);

  // Build graph
  const nodes: Node[] = [
      { id: targetTag, name: targetTag, category: targetTagCategory, value: targetTagCount }
  ];
  const links: Link[] = [];

  sortedNeighbors.forEach(([tagOrUser, val]) => {
      nodes.push({ id: tagOrUser, name: tagOrUser, category: val.category, value: val.count });
      links.push({ source: targetTag, target: tagOrUser, value: val.count });
  });

  return { nodes, links };
}

export interface UserNeighborParams {
    data: ImageRecord[];
    userId: string;
    limit?: number;
    metric?: Metric;
    allowedGeneralTags?: Set<string> | string[];
    allowedCategories?: (Category | 'user')[]; // To filter returned tags by category
}

export function getUserTagNeighbors({
    data,
    userId,
    limit = 30,
    metric = 'interactions',
    allowedGeneralTags,
    allowedCategories
}: UserNeighborParams): { nodes: Node[], links: Link[] } {
    
    const allowedCatSet = allowedCategories 
        ? new Set(allowedCategories.filter(c => c !== 'user') as Category[]) 
        : null;
    const includeUsers = allowedCategories?.includes('user') ?? false;

    const neighborsMap = new Map<string, { count: number, category: Category | 'user' }>();
    let userWeight = 0;

    // Manual iteration to get both tags and co-reactors in one pass
    // (Avoid re-using getTopUserTags since we need co-reactors too)
    
    const generalWhitelist = allowedGeneralTags 
        ? (Array.isArray(allowedGeneralTags) ? new Set(allowedGeneralTags) : allowedGeneralTags) 
        : null;

    for (const record of data) {
        const isReactor = record.reactors.includes(userId);
        const isAuthor = record.author === userId;
        
        // Determine if this user is active in this record based on metric
        let isActive = false;
        let weight = 0;

        if (metric === 'popularity') {
            if (isAuthor) {
                isActive = true;
                weight = record.reactors.length;
            }
        } else if (metric === 'posts') {
            if (isAuthor) {
                isActive = true;
                weight = 1;
            }
        } else if (metric === 'reactions') {
            if (isReactor) {
                isActive = true;
                weight = 1;
            }
        } else {
            // interactions
            if (isReactor || isAuthor) {
                isActive = true;
                weight = 1;
            }
        }

        if (!isActive) continue;
        userWeight += weight;

        // 1. Add Tags
        ['character', 'copyright', 'artist', 'general'].forEach(cat => {
            const catKey = cat as Category;
            // Optimization: Check allowedCatSet here if you want strict filtering before adding
            // But we might want to filter AFTER to just sort by top
            if (allowedCatSet && !allowedCatSet.has(catKey)) return;

            record.tags[catKey]?.forEach(tag => {
                if (catKey === 'general' && generalWhitelist && !generalWhitelist.has(tag)) return;
                
                const current = neighborsMap.get(tag) || { count: 0, category: catKey };
                neighborsMap.set(tag, { count: current.count + weight, category: catKey });
            });
        });

        // 2. Add Co-reactors (User Neighbors)
        if (includeUsers) {
             const coUsers: string[] = [];
             if (metric === 'posts') {
                // For posts, neighbor is other authors? No, neighbor is usually co-occurrence.
                // Author is unique. So no co-author.
             } else if (metric === 'reactions') {
                 // Reactions: I reacted. Who else reacted?
                 // Co-reactors + Author?
                 // "Reactions given" -> my reaction aligns with others who reacted.
                 // If I reacted, does author matter? Maybe.
                 // Let's include co-reactors.
                 if (isReactor) {
                     record.reactors.forEach(u => {
                         if (u !== userId) coUsers.push(u);
                     });
                 }
             } else {
                 // Interactions: I reacted. Who else reacted?
                 if (isReactor || isAuthor) {
                     if (record.author && record.author !== userId) coUsers.push(record.author);
                     record.reactors.forEach(u => {
                         if (u !== userId) coUsers.push(u);
                     });
                 }
             }

             const uniqueCoUsers = new Set(coUsers);
             uniqueCoUsers.forEach(u => {
                 const current = neighborsMap.get(u) || { count: 0, category: 'user' };
                 // For user-user edges, weight is 1 per interaction usually
                 // Unless popularity, then 1 per reaction I guess?
                 neighborsMap.set(u, { count: current.count + 1, category: 'user' });
             });
        }
    }

    // Convert to list and sort
    const sortedNeighbors = Array.from(neighborsMap.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, limit);

    const nodes: Node[] = [
        { id: userId, name: userId, category: 'user', value: userWeight }
    ];
    const links: Link[] = [];

    sortedNeighbors.forEach(([id, val]) => {
        nodes.push({ id: id, name: id, category: val.category, value: val.count });
        links.push({ source: userId, target: id, value: val.count });
    });

    return { nodes, links };
}

export interface TagFanStats {
  tag: string;
  category: Category;
  fanUserId: string;
  fanCount: number;
  totalCount: number;
}

export interface BiggestFansParams {
  data: ImageRecord[];
  limit?: number;
  metric?: Metric;
  allowedGeneralTags?: Set<string> | string[];
  categories?: Category[];
}

export function getBiggestFansByTag({
  data,
  limit = 50,
  metric = 'interactions',
  allowedGeneralTags,
  categories
}: BiggestFansParams): TagFanStats[] {
  // 1. Aggregate stats per tag: Total count, and per-user count
  // Map<tag, { category: Category, total: number, users: Map<userId, number> }>
  const tagStats = new Map<string, { category: Category, total: number, users: Map<string, number> }>();

  const allowedCats = new Set<Category>();
  if (categories) categories.forEach(c => allowedCats.add(c));
  else ['character', 'copyright', 'artist', 'general'].forEach(c => allowedCats.add(c as Category));

  const generalWhitelist = allowedGeneralTags
    ? (Array.isArray(allowedGeneralTags) ? new Set(allowedGeneralTags) : allowedGeneralTags)
    : null;

  for (const record of data) {
    // Identify active users and their contribution weight for this record
    // This logic mirrors getTopUsers / getGlobalNetwork active user logic
    const activeUsers: { userId: string, weight: number }[] = [];
    let recordWeightForTotal = 0; // How much this record contributes to the tag's total "metric" score

    if (metric === 'posts') {
       // Metric: Posts
       // Fan = Author. Count = number of posts authored.
       // Tag Total = number of posts with this tag.
       if (record.author) {
         activeUsers.push({ userId: record.author, weight: 1 });
       }
       recordWeightForTotal = 1;
    } else if (metric === 'reactions') {
       // Metric: Reactions
       // Fan = Reactor. Count = number of reactions given to posts with this tag.
       // Tag Total = sum of all reactions on posts with this tag.
       record.reactors.forEach(u => activeUsers.push({ userId: u, weight: 1 }));
       recordWeightForTotal = record.reactors.length;
    } else if (metric === 'popularity') {
       // Metric: Popularity
       // Fan = Author. Count = sum of reactions received on their posts with this tag.
       // Tag Total = sum of reactions on all posts with this tag.
       if (record.author) {
         activeUsers.push({ userId: record.author, weight: record.reactors.length });
       }
       recordWeightForTotal = record.reactors.length;
    } else {
       // Metric: Interactions (default)
       // Fan = Author (1) OR Reactor (1).
       // Tag Total = sum of unique people (author+reactors) on posts with this tag.
       const uniquePeople = new Set<string>(record.reactors);
       if (record.author) uniquePeople.add(record.author);
       
       uniquePeople.forEach(u => activeUsers.push({ userId: u, weight: 1 }));
       recordWeightForTotal = uniquePeople.size;
    }

    if (recordWeightForTotal === 0 && activeUsers.length === 0) continue;

    // Apply to all tags in record
    allowedCats.forEach(cat => {
        record.tags[cat]?.forEach(tag => {
            if (cat === 'general' && generalWhitelist && !generalWhitelist.has(tag)) return;

            let entry = tagStats.get(tag);
            if (!entry) {
                entry = { category: cat, total: 0, users: new Map() };
                tagStats.set(tag, entry);
            }

            entry.total += recordWeightForTotal;

            activeUsers.forEach(({ userId, weight }) => {
                const current = entry!.users.get(userId) || 0;
                entry!.users.set(userId, current + weight);
            });
        });
    });
  }

  // 2. For each tag, find the biggest fan
  const results: TagFanStats[] = [];
  
  for (const [tag, stats] of tagStats.entries()) {
      if (stats.users.size === 0) continue;
      
      let maxFan = '';
      let maxFanCount = -1;
      
      for (const [user, count] of stats.users.entries()) {
          if (count > maxFanCount) {
              maxFanCount = count;
              maxFan = user;
          }
      }
      
      results.push({
          tag,
          category: stats.category,
          fanUserId: maxFan,
          fanCount: maxFanCount,
          totalCount: stats.total
      });
  }

  // 3. Sort and limit
  // Sort by fanCount? Or totalCount? Usually "Biggest Fan of Top Tags" implies sorting by tag importance (totalCount) or fan intensity (fanCount).
  // Let's sort by fanCount to highlight "Superfans".
  results.sort((a, b) => b.fanCount - a.fanCount);
  
  return results.slice(0, limit);
}

export interface TagUserShare {
  userId: string;
  count: number;
  percentage: number;
}

export function getTagFanBreakdown({
  data,
  tag,
  category,
  metric = 'interactions'
}: {
  data: ImageRecord[];
  tag: string;
  category: Category;
  metric?: Metric;
}): TagUserShare[] {
    const userCounts = new Map<string, number>();
    let total = 0;

    for (const record of data) {
        // Check if tag is present in the specified category
        const tagsInCat = record.tags[category];
        if (!tagsInCat || !tagsInCat.includes(tag)) continue;

        const activeUsers: { userId: string, weight: number }[] = [];
        let recordWeightForTotal = 0;

        if (metric === 'posts') {
           if (record.author) {
             activeUsers.push({ userId: record.author, weight: 1 });
           }
           recordWeightForTotal = 1;
        } else if (metric === 'reactions') {
           record.reactors.forEach(u => activeUsers.push({ userId: u, weight: 1 }));
           recordWeightForTotal = record.reactors.length;
        } else if (metric === 'popularity') {
           if (record.author) {
             activeUsers.push({ userId: record.author, weight: record.reactors.length });
           }
           recordWeightForTotal = record.reactors.length;
        } else {
           // interactions
           const uniquePeople = new Set<string>(record.reactors);
           if (record.author) uniquePeople.add(record.author);
           uniquePeople.forEach(u => activeUsers.push({ userId: u, weight: 1 }));
           recordWeightForTotal = uniquePeople.size;
        }

        if (activeUsers.length === 0) continue;
        
        total += recordWeightForTotal;
        activeUsers.forEach(({ userId, weight }) => {
            userCounts.set(userId, (userCounts.get(userId) || 0) + weight);
        });
    }
    
    if (total === 0) return [];

    return Array.from(userCounts.entries())
        .map(([userId, count]) => ({
            userId,
            count,
            percentage: (count / total) * 100
        }))
        .sort((a, b) => b.count - a.count);
}
