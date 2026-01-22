import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tag as TagIcon, Layers, Plus, Trash2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import { AddGroupForm } from '@/components/forms/AddGroupForm';
import { EditGroupForm } from '@/components/forms/EditGroupForm';
import { AddTagForm } from '@/components/forms/AddTagForm';
import { EditTagForm } from '@/components/forms/EditTagForm';
import { GroupsService } from '@/services/groups';
import type { PrimaryGroup } from '@/services/groups';
import { TagsService } from '@/services/tags';
import type { Tag } from '@/services/tags';
import { AssetsService } from '@/services/assets';
import type { Asset } from '@/services/assets';
import { cn } from '@/lib/utils';

export function GroupsTags() {
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddGroup, setShowAddGroup] = useState(false);
    const [showAddTag, setShowAddTag] = useState(false);
    const [editingGroup, setEditingGroup] = useState<PrimaryGroup | null>(null);
    const [editingTag, setEditingTag] = useState<Tag | null>(null);
    const [isGroupDeleteModalOpen, setIsGroupDeleteModalOpen] = useState(false);
    const [isTagDeleteModalOpen, setIsTagDeleteModalOpen] = useState(false);

    const queryClient = useQueryClient();

    const { data: groups = [], isLoading: isLoadingGroups } = useQuery<PrimaryGroup[]>({
        queryKey: ['primary-groups'],
        queryFn: GroupsService.getAll,
    });

    const { data: tags = [], isLoading: isLoadingTags } = useQuery<Tag[]>({
        queryKey: ['tags'],
        queryFn: TagsService.getAll,
    });

    const { data: assets = [], isLoading: isLoadingAssets } = useQuery<Asset[]>({
        queryKey: ['assets'],
        queryFn: AssetsService.getAll,
    });

    // Calculate usage
    const groupUsage = (assets || []).reduce((acc, asset) => {
        if (asset.group_id) {
            acc[asset.group_id] = (acc[asset.group_id] || 0) + 1;
        }
        return acc;
    }, {} as Record<number, number>);

    const tagUsage = (assets || []).reduce((acc, asset) => {
        if (asset.tags) {
            asset.tags.forEach((tag: Tag) => {
                acc[tag.id] = (acc[tag.id] || 0) + 1;
            });
        }
        return acc;
    }, {} as Record<number, number>);

    const deleteGroupMutation = useMutation({
        mutationFn: GroupsService.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['primary-groups'] });
            queryClient.invalidateQueries({ queryKey: ['portfolio-allocation'] });
        }
    });

    const deleteTagMutation = useMutation({
        mutationFn: TagsService.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tags'] });
            queryClient.invalidateQueries({ queryKey: ['portfolio-allocation'] });
        }
    });

    const handleDeleteGroup = (e: React.MouseEvent, group: PrimaryGroup) => {
        e.preventDefault();
        e.stopPropagation();

        if (groupUsage[group.id] > 0) {
            return;
        }

        setEditingGroup(group);
        setIsGroupDeleteModalOpen(true);
    };

    const handleDeleteTag = (e: React.MouseEvent, tag: Tag) => {
        e.preventDefault();
        e.stopPropagation();

        if (tagUsage[tag.id] > 0) {
            return;
        }

        setEditingTag(tag);
        setIsTagDeleteModalOpen(true);
    };

    const filteredGroups = groups.filter(g =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredTags = tags.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isLoading = isLoadingGroups || isLoadingTags || isLoadingAssets;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-muted-foreground animate-pulse">Loading groups and tags...</div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header */}
            <div className="space-y-2">
                <div className="flex items-center gap-3">
                    <Layers className="h-6 w-6 text-primary" />
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Groups & Tags</h1>
                </div>
                <p className="text-muted-foreground text-lg">
                    Organize your assets by strategic groups and flexible labels.
                </p>
            </div>

            {/* Search */}
            <div className="relative group max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                    type="text"
                    placeholder="Search groups or tags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-10 py-3 glass-strong rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Groups Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Layers className="w-5 h-5 text-primary" />
                            Primary Groups
                        </h2>
                        <Button
                            onClick={() => setShowAddGroup(true)}
                            variant="premium"
                            className="group shrink-0"
                        >
                            <Plus className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform duration-300" />
                            Add
                        </Button>
                    </div>

                    <div className="space-y-3">
                        {filteredGroups.length === 0 ? (
                            <div className="p-8 text-center glass-strong rounded-xl border border-dashed border-border/50">
                                <p className="text-muted-foreground text-sm italic">No groups found.</p>
                            </div>
                        ) : (
                            filteredGroups.map(group => (
                                <div
                                    key={group.id}
                                    onClick={() => setEditingGroup(group)}
                                    className="group flex items-center justify-between p-4 glass-strong rounded-xl border border-border/50 hover:border-primary/30 transition-all cursor-pointer"
                                >
                                    <div className="flex items-center gap-4">
                                        <div
                                            className="w-4 h-4 rounded-full shadow-sm"
                                            style={{ backgroundColor: group.color }}
                                        />
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-lg text-foreground leading-none">{group.name}</span>
                                            <div className="flex flex-col gap-0.5">
                                                {group.description && (
                                                    <span className="text-sm text-muted-foreground line-clamp-1">{group.description}</span>
                                                )}
                                                {groupUsage[group.id] > 0 && (
                                                    <span className="text-xs text-muted-foreground font-medium">
                                                        Used by {groupUsage[group.id]} asset{groupUsage[group.id] !== 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => handleDeleteGroup(e, group)}
                                        disabled={groupUsage[group.id] > 0}
                                        className={cn(
                                            "p-2 rounded-lg transition-all",
                                            groupUsage[group.id] > 0
                                                ? "text-muted-foreground/30 cursor-not-allowed"
                                                : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                        )}
                                        title={groupUsage[group.id] > 0 ? `Cannot delete: assigned to ${groupUsage[group.id]} asset(s)` : "Delete Group"}
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground italic px-2">
                        Assets belong to exactly one primary group. Used for top-level allocation.
                    </p>
                </div>

                {/* Tags Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <TagIcon className="w-5 h-5 text-primary" />
                            Tags
                        </h2>
                        <Button
                            onClick={() => setShowAddTag(true)}
                            variant="premium"
                            className="group shrink-0"
                        >
                            <Plus className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform duration-300" />
                            Add
                        </Button>
                    </div>

                    <div className="space-y-3">
                        {filteredTags.length === 0 ? (
                            <div className="p-8 text-center glass-strong rounded-xl border border-dashed border-border/50">
                                <p className="text-muted-foreground text-sm italic">No tags found.</p>
                            </div>
                        ) : (
                            filteredTags.map(tag => (
                                <div
                                    key={tag.id}
                                    onClick={() => setEditingTag(tag)}
                                    className="group flex items-center justify-between p-4 glass-strong rounded-xl border border-border/50 hover:border-primary/30 transition-all cursor-pointer"
                                >
                                    <div className="flex items-center gap-4">
                                        <div
                                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm"
                                            style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                                        >
                                            #
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-lg text-foreground leading-none">{tag.name}</span>
                                            <div className="flex flex-col gap-0.5">
                                                {tag.description && (
                                                    <span className="text-sm text-muted-foreground line-clamp-1">{tag.description}</span>
                                                )}
                                                {tagUsage[tag.id] > 0 && (
                                                    <span className="text-xs text-muted-foreground font-medium">
                                                        Used by {tagUsage[tag.id]} asset{tagUsage[tag.id] !== 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => handleDeleteTag(e, tag)}
                                        disabled={tagUsage[tag.id] > 0}
                                        className={cn(
                                            "p-2 rounded-lg transition-all",
                                            tagUsage[tag.id] > 0
                                                ? "text-muted-foreground/30 cursor-not-allowed"
                                                : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                        )}
                                        title={tagUsage[tag.id] > 0 ? `Cannot delete: assigned to ${tagUsage[tag.id]} asset(s)` : "Delete Tag"}
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground italic px-2">
                        Tags are flexible labels. Assets can have multiple tags for cross-cutting analysis.
                    </p>
                </div>
            </div>

            {/* Modals */}
            {(showAddGroup || editingGroup) && !isGroupDeleteModalOpen && (
                editingGroup ? (
                    <EditGroupForm
                        group={editingGroup}
                        onClose={() => {
                            setShowAddGroup(false);
                            setEditingGroup(null);
                        }}
                        onDelete={() => setIsGroupDeleteModalOpen(true)}
                        deleteDisabled={groupUsage[editingGroup.id] > 0}
                        deleteDisabledTooltip={groupUsage[editingGroup.id] > 0 ? `Cannot delete: assigned to ${groupUsage[editingGroup.id]} asset(s)` : undefined}
                    />
                ) : (
                    <AddGroupForm
                        onClose={() => {
                            setShowAddGroup(false);
                            setEditingGroup(null);
                        }}
                    />
                )
            )}

            {isGroupDeleteModalOpen && editingGroup && (
                <DeleteConfirmModal
                    isOpen={true}
                    onClose={() => {
                        setIsGroupDeleteModalOpen(false);
                        if (!showAddGroup) setEditingGroup(null);
                    }}
                    onConfirm={() => {
                        deleteGroupMutation.mutate(editingGroup.id);
                        setIsGroupDeleteModalOpen(false);
                        setEditingGroup(null);
                        setShowAddGroup(false);
                    }}
                    title="Primary Group"
                    itemName={editingGroup.name}
                    isDeleting={deleteGroupMutation.isPending}
                    warning="Deleting a group will move all associated assets to 'Uncategorized'. This action cannot be undone."
                />
            )}

            {(showAddTag || editingTag) && !isTagDeleteModalOpen && (
                editingTag ? (
                    <EditTagForm
                        tag={editingTag}
                        onClose={() => {
                            setShowAddTag(false);
                            setEditingTag(null);
                        }}
                        onDelete={() => setIsTagDeleteModalOpen(true)}
                        deleteDisabled={tagUsage[editingTag.id] > 0}
                        deleteDisabledTooltip={tagUsage[editingTag.id] > 0 ? `Cannot delete: assigned to ${tagUsage[editingTag.id]} asset(s)` : undefined}
                    />
                ) : (
                    <AddTagForm
                        onClose={() => {
                            setShowAddTag(false);
                            setEditingTag(null);
                        }}
                    />
                )
            )}

            {isTagDeleteModalOpen && editingTag && (
                <DeleteConfirmModal
                    isOpen={true}
                    onClose={() => {
                        setIsTagDeleteModalOpen(false);
                        if (!showAddTag) setEditingTag(null);
                    }}
                    onConfirm={() => {
                        deleteTagMutation.mutate(editingTag.id);
                        setIsTagDeleteModalOpen(false);
                        setEditingTag(null);
                        setShowAddTag(false);
                    }}
                    title="Tag"
                    itemName={editingTag.name}
                    isDeleting={deleteTagMutation.isPending}
                    warning="Removing this tag will detach it from all associated assets. This action cannot be undone."
                />
            )}
        </div>
    );
}
